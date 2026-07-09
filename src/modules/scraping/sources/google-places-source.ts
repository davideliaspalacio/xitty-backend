import { Injectable, Logger } from '@nestjs/common';

import type { RawItem, SourceReview } from '../scraper-source.interface';
import type { Source } from './source.interface';

/**
 * Tipos de lugar soportados por Google Places API (New) v1.
 * Mapean directamente al campo `includedTypes` del request.
 */
export type GooglePlacesType =
  | 'restaurant'
  | 'tourist_attraction'
  | 'event_venue';

export interface GooglePlacesConfig {
  /** Latitud del centro de busqueda. */
  lat: number;
  /** Longitud del centro de busqueda. */
  lng: number;
  /** Radio de busqueda en metros (1..50000 segun Google). */
  radius_m: number;
  /** Tipo de lugar a buscar. */
  type: GooglePlacesType;
  /** Maximo de resultados a devolver (1..20 segun Google). */
  max_results: number;
}

/**
 * Opciones de construccion — todo opcional, todo inyectable para tests.
 * No usamos NestJS DI aqui porque la source vive como provider en el module
 * pero la firma de Source es testeable sin contenedor.
 */
export interface GooglePlacesSourceOptions {
  /** Implementacion de fetch — default = global fetch nativo. */
  fetchImpl?: typeof fetch;
  /** Funcion de sleep — inyectable para tests (default = setTimeout). */
  sleepFn?: (ms: number) => Promise<void>;
  /** Maximo de retries en caso de 429. Default = 3. */
  maxRetries?: number;
  /** Backoff base en ms — el delay real es base * 2^attempt. Default = 500. */
  baseBackoffMs?: number;
}

type JsonRecord = Record<string, unknown>;

/**
 * Source que consulta Google Places API (New) v1 — endpoint `places:searchNearby`.
 *
 * Docs: https://developers.google.com/maps/documentation/places/web-service/nearby-search
 *
 * Diseno:
 *  - SIN SDK extra: usa el fetch nativo de Node (>=18). El SDK oficial pesa
 *    mucho y no aporta nada que no podamos hacer con un POST + headers.
 *  - API key opcional: si no esta `GOOGLE_MAPS_API_KEY`, devuelve mock data
 *    plausible de Barranquilla — el pipeline puede correr en dev sin secretos.
 *  - Best-effort: cualquier error (network, 4xx, 5xx, 429 agotado) devuelve []
 *    en vez de tirar — asi el runner sigue procesando otras sources.
 *  - Retry exponencial SOLO en 429 (rate limit). Otros 4xx/5xx son errores
 *    permanentes en el contexto de un fetch — reintentar no ayuda.
 */
@Injectable()
export class GooglePlacesSource implements Source<GooglePlacesConfig> {
  readonly kind = 'google-places';
  private readonly logger = new Logger(GooglePlacesSource.name);

  private readonly fetchImpl: typeof fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;

  private static readonly ENDPOINT =
    'https://places.googleapis.com/v1/places:searchNearby';

  /**
   * Field mask requerido por Places API (New) v1 — define que campos retorna.
   * Pedimos solo lo que mapeamos a RawItem para minimizar costo.
   */
  private static readonly FIELD_MASK = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.editorialSummary',
    'places.types',
    'places.primaryType',
    'places.googleMapsUri',
    // Fotos + señal de reseñas: deterministas, para imagen y quality/realidad.
    'places.photos',
    'places.rating',
    'places.userRatingCount',
    'places.priceLevel',
    // Perfil de contacto/negocio (lo que pide un viajero real):
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.regularOpeningHours',
    'places.businessStatus',
    // Opiniones reales de la gente (campo premium de Google — más caro, pero es
    // lo que le da alma al perfil). Hasta 5 reseñas por lugar.
    'places.reviews',
  ].join(',');

  /**
   * Construye la URL del endpoint de media de Places API (New) para una foto.
   * NO incluye la API key: el descargador (PhotoStorageService) la agrega como
   * header `X-Goog-Api-Key` al bajar los bytes, así la key nunca se persiste ni
   * se expone en una URL pública.
   */
  static photoMediaUrl(photoName: string): string {
    return `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=1200`;
  }

  constructor(opts: GooglePlacesSourceOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.sleepFn =
      opts.sleepFn ??
      ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseBackoffMs = opts.baseBackoffMs ?? 500;
  }

  async fetch(config: GooglePlacesConfig): Promise<RawItem[]> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      this.logger.warn(
        'GOOGLE_MAPS_API_KEY no configurada — devolviendo mock data',
      );
      return this.mockData(config);
    }

    try {
      const raw = await this.fetchWithRetry(config, apiKey);
      return this.parsePlacesResponse(raw);
    } catch (err: unknown) {
      this.logger.warn(
        `GooglePlacesSource fetch fallo (best-effort, devolviendo []): ${errorMessage(err)}`,
      );
      return [];
    }
  }

  // ── HTTP + retry ────────────────────────────────────────────────────

  private async fetchWithRetry(
    config: GooglePlacesConfig,
    apiKey: string,
  ): Promise<unknown> {
    const body = JSON.stringify({
      includedTypes: [config.type],
      maxResultCount: clamp(config.max_results, 1, 20),
      locationRestriction: {
        circle: {
          center: { latitude: config.lat, longitude: config.lng },
          radius: clamp(config.radius_m, 1, 50000),
        },
      },
    });

    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': GooglePlacesSource.FIELD_MASK,
      },
      body,
    };

    // 1 intento inicial + N retries SOLO en 429
    let attempt = 0;
    while (true) {
      const resp = await this.fetchImpl(GooglePlacesSource.ENDPOINT, init);

      if (resp.ok) {
        return (await resp.json()) as unknown;
      }

      if (resp.status === 429 && attempt < this.maxRetries) {
        // Backoff exponencial: base * 2^attempt + jitter pequeno
        const delay =
          this.baseBackoffMs * Math.pow(2, attempt) +
          Math.floor(Math.random() * 25);
        this.logger.warn(
          `GooglePlacesSource 429 rate-limited (attempt ${attempt + 1}/${this.maxRetries}), backoff ${delay}ms`,
        );
        await this.sleepFn(delay);
        attempt += 1;
        continue;
      }

      // 4xx no-429 o 5xx → error definitivo
      const text = await safeText(resp);
      throw new Error(
        `Google Places API ${resp.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      );
    }
  }

  // ── parseo de la respuesta Places API (New) v1 ─────────────────────

  private parsePlacesResponse(raw: unknown): RawItem[] {
    const rawRecord = isRecord(raw) ? raw : null;
    const places = rawRecord?.places;
    if (!Array.isArray(places)) return [];

    const items: RawItem[] = [];
    for (const place of places) {
      if (!isRecord(place)) continue;
      const id = stringField(place, 'id');
      const name = textObjectField(place, 'displayName');
      if (!id || !name) continue;

      // Saltamos negocios cerrados permanentemente: no le sirven al viajero.
      const businessStatus = stringField(place, 'businessStatus');
      if (businessStatus === 'CLOSED_PERMANENTLY') continue;

      const photoName = firstPhotoName(place);
      const hours = weekdayDescriptions(place);
      const location = recordField(place, 'location');
      const types = stringArrayField(place, 'types');

      items.push({
        external_id: String(id),
        name: String(name),
        description: textObjectField(place, 'editorialSummary'),
        category: stringField(place, 'primaryType') ?? types?.[0] ?? null,
        address: stringField(place, 'formattedAddress'),
        latitude: location ? numberField(location, 'latitude') : null,
        longitude: location ? numberField(location, 'longitude') : null,
        source_url: stringField(place, 'googleMapsUri'),
        // Deterministas de la fuente (no de la IA):
        image_url: photoName
          ? GooglePlacesSource.photoMediaUrl(photoName)
          : null,
        rating: numberField(place, 'rating'),
        review_count: numberField(place, 'userRatingCount'),
        phone:
          stringField(place, 'nationalPhoneNumber') ??
          stringField(place, 'internationalPhoneNumber'),
        website: stringField(place, 'websiteUri'),
        opening_hours: hours,
        price_level: mapPriceLevel(place.priceLevel),
        business_status: businessStatus,
        reviews: parseReviews(place.reviews),
        raw_payload: place,
      });
    }
    return items;
  }

  // ── mock data para dev sin API key ─────────────────────────────────

  private mockData(config: GooglePlacesConfig): RawItem[] {
    const all = MOCK_BARRANQUILLA_PLACES.filter(
      (m) => m.category === config.type,
    );
    const limit = Math.max(0, Math.min(config.max_results, all.length));
    return all.slice(0, limit).map((m, i) => ({
      external_id: `mock-google-places-${m.slug}`,
      name: m.name,
      description: m.description,
      category: m.category,
      address: m.address,
      latitude: m.latitude,
      longitude: m.longitude,
      source_url: null,
      // MODO DEMO (sin API key): NADA de fotos random — confunden y parecen
      // basura. Dejamos image_url = null → el frontend pinta un placeholder de
      // marca. El resto del perfil (teléfono, web, horarios, rating) SÍ va
      // completo, para ver el pipeline real funcionando de punta a punta.
      image_url: null,
      rating: Math.round((4.1 + (i % 5) * 0.15) * 10) / 10,
      review_count: 60 + (i % 7) * 55,
      phone: `+57 605 ${300 + i} ${1000 + i * 7}`,
      website: `https://ejemplo-${m.slug}.co`,
      opening_hours: [
        'Lunes a Jueves: 12:00–22:00',
        'Viernes y Sábado: 12:00–23:30',
        'Domingo: 12:00–21:00',
      ],
      price_level: 2 + (i % 2),
      business_status: 'OPERATIONAL',
      // Reseñas de muestra (demo) para ver el bloque de opiniones funcionando.
      reviews: [
        {
          author: 'María C.',
          rating: 5,
          text: 'Excelente atención y sabor. Volvería mil veces, un imperdible.',
          relative_time: 'hace 2 semanas',
          publish_time: null,
        },
        {
          author: 'Andrés P.',
          rating: 4,
          text: 'Muy buen ambiente y platos generosos. El servicio, un poco lento.',
          relative_time: 'hace 1 mes',
          publish_time: null,
        },
      ],
      raw_payload: { mock: true, ...m },
    }));
  }
}

// ──────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** Convierte las reseñas de Google (Places New) a nuestro SourceReview[]. */
function parseReviews(reviews: unknown): SourceReview[] | null {
  if (!Array.isArray(reviews) || reviews.length === 0) return null;
  const out: SourceReview[] = [];
  for (const review of reviews.slice(0, 5)) {
    if (!isRecord(review)) continue;
    const text =
      textObjectField(review, 'text') ??
      textObjectField(review, 'originalText');
    const author = recordTextField(review, 'authorAttribution', 'displayName');
    if (!text && !author) continue;
    out.push({
      author,
      rating: numberField(review, 'rating'),
      text,
      relative_time: stringField(review, 'relativePublishTimeDescription'),
      publish_time: stringField(review, 'publishTime'),
    });
  }
  return out.length > 0 ? out : null;
}

/** Mapea el enum priceLevel de Google Places (New) a price_range 1..4. */
function mapPriceLevel(pl: unknown): number | null {
  switch (pl) {
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 1;
    case 'PRICE_LEVEL_MODERATE':
      return 2;
    case 'PRICE_LEVEL_EXPENSIVE':
      return 3;
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 4;
    default:
      return null; // FREE / UNSPECIFIED / ausente
  }
}

async function safeText(resp: Pick<Response, 'text'>): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return '';
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function recordField(record: JsonRecord, key: string): JsonRecord | null {
  const value = record[key];
  return isRecord(value) ? value : null;
}

function stringField(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberField(record: JsonRecord, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArrayField(record: JsonRecord, key: string): string[] | null {
  const value = record[key];
  if (!Array.isArray(value)) return null;
  const strings = value.filter(
    (item): item is string => typeof item === 'string',
  );
  return strings.length > 0 ? strings : null;
}

function textObjectField(record: JsonRecord, key: string): string | null {
  const value = recordField(record, key);
  return value ? stringField(value, 'text') : null;
}

function recordTextField(
  record: JsonRecord,
  recordKey: string,
  textKey: string,
): string | null {
  const value = recordField(record, recordKey);
  return value ? stringField(value, textKey) : null;
}

function firstPhotoName(place: JsonRecord): string | null {
  const photos = place.photos;
  if (!Array.isArray(photos)) return null;
  const first = photos.find(isRecord);
  return first ? stringField(first, 'name') : null;
}

function weekdayDescriptions(place: JsonRecord): string[] | null {
  const openingHours = recordField(place, 'regularOpeningHours');
  return openingHours
    ? stringArrayField(openingHours, 'weekdayDescriptions')
    : null;
}

/**
 * 8 lugares plausibles de Barranquilla por categoria, usados como fallback
 * cuando no hay API key. Coordenadas reales aproximadas para que el pipeline
 * de enrichment / dedup tenga datos creibles.
 *
 * NOTA: no son datos de produccion — solo para que dev/test funcione sin secretos.
 */
const MOCK_BARRANQUILLA_PLACES: Array<{
  slug: string;
  name: string;
  description: string;
  category: GooglePlacesType;
  address: string;
  latitude: number;
  longitude: number;
}> = [
  // ── restaurant ────────────────────────────────────────────────────
  {
    slug: 'la-cueva',
    name: 'La Cueva',
    description:
      'Restaurante-bar historico vinculado al Grupo de Barranquilla (Garcia Marquez, Alvaro Cepeda).',
    category: 'restaurant',
    address: 'Carrera 43 #59-03, Barranquilla',
    latitude: 10.9914,
    longitude: -74.7891,
  },
  {
    slug: 'aluna',
    name: 'Aluna',
    description: 'Cocina caribena contemporanea en El Prado.',
    category: 'restaurant',
    address: 'Carrera 53 #76-115, Barranquilla',
    latitude: 11.0023,
    longitude: -74.8121,
  },
  {
    slug: 'cucayo',
    name: 'Cucayo',
    description: 'Cocina del Caribe colombiano con foco en producto local.',
    category: 'restaurant',
    address: 'Carrera 51B #79-97, Barranquilla',
    latitude: 11.0078,
    longitude: -74.8104,
  },
  {
    slug: 'la-bonga-del-sinu',
    name: 'La Bonga del Sinu',
    description: 'Asadero costeno tradicional, especialidad en carnes.',
    category: 'restaurant',
    address: 'Calle 84 #51B-19, Barranquilla',
    latitude: 11.0152,
    longitude: -74.8092,
  },
  {
    slug: 'narcobollo',
    name: 'Narcobollo',
    description: 'Cocina urbana caribena, conceptos creativos con bollo.',
    category: 'restaurant',
    address: 'Carrera 51B #87-50, Barranquilla',
    latitude: 11.0188,
    longitude: -74.8087,
  },
  {
    slug: 'el-celler-de-la-libertad',
    name: 'El Celler de la Libertad',
    description: 'Cocina de autor con maridajes y carta de vinos.',
    category: 'restaurant',
    address: 'Carrera 52 #74-90, Barranquilla',
    latitude: 10.9989,
    longitude: -74.8125,
  },
  {
    slug: 'la-perla',
    name: 'La Perla',
    description: 'Tradicional restaurante de pescados y mariscos.',
    category: 'restaurant',
    address: 'Calle 84 #43-21, Barranquilla',
    latitude: 11.0166,
    longitude: -74.7943,
  },
  {
    slug: 'devora',
    name: 'Devora',
    description: 'Cocina latinoamericana con coctelería.',
    category: 'restaurant',
    address: 'Carrera 53 #82-114, Barranquilla',
    latitude: 11.0149,
    longitude: -74.8108,
  },

  // ── tourist_attraction ────────────────────────────────────────────
  {
    slug: 'malecon-del-rio',
    name: 'Gran Malecon del Rio',
    description:
      'Paseo a orillas del rio Magdalena, espacios deportivos, gastronomicos y culturales.',
    category: 'tourist_attraction',
    address: 'Via 40, Barranquilla',
    latitude: 10.9783,
    longitude: -74.7626,
  },
  {
    slug: 'museo-del-caribe',
    name: 'Museo del Caribe',
    description:
      'Museo interactivo dedicado a la cultura del Caribe colombiano.',
    category: 'tourist_attraction',
    address: 'Calle 36 #46-66, Barranquilla',
    latitude: 10.9759,
    longitude: -74.7917,
  },
  {
    slug: 'casa-del-carnaval',
    name: 'Casa del Carnaval',
    description:
      'Sede oficial del Carnaval de Barranquilla, exhibe disfraces y patrimonio cultural.',
    category: 'tourist_attraction',
    address: 'Carrera 54 #49B-39, Barranquilla',
    latitude: 10.9852,
    longitude: -74.7882,
  },
  {
    slug: 'catedral-metropolitana',
    name: 'Catedral Metropolitana Maria Reina',
    description: 'Catedral moderna emblematica del centro de Barranquilla.',
    category: 'tourist_attraction',
    address: 'Calle 53 #46-09, Barranquilla',
    latitude: 10.9874,
    longitude: -74.7917,
  },
  {
    slug: 'parque-cultural-del-caribe',
    name: 'Parque Cultural del Caribe',
    description:
      'Complejo cultural que incluye el Museo del Caribe y biblioteca.',
    category: 'tourist_attraction',
    address: 'Calle 36 #46-66, Barranquilla',
    latitude: 10.9763,
    longitude: -74.7912,
  },
  {
    slug: 'plaza-de-la-paz',
    name: 'Plaza de la Paz',
    description: 'Plaza civica icónica frente a la Catedral.',
    category: 'tourist_attraction',
    address: 'Calle 53 con Carrera 46, Barranquilla',
    latitude: 10.9881,
    longitude: -74.7921,
  },
  {
    slug: 'bocas-de-ceniza',
    name: 'Bocas de Ceniza',
    description:
      'Desembocadura del rio Magdalena en el Caribe, accesible por tarima ferroviaria.',
    category: 'tourist_attraction',
    address: 'Tajamar Occidental, Barranquilla',
    latitude: 11.0915,
    longitude: -74.8527,
  },
  {
    slug: 'mirador-la-loma',
    name: 'Mirador La Loma',
    description: 'Vista panoramica del rio Magdalena y la ciudad.',
    category: 'tourist_attraction',
    address: 'Barrio La Loma, Barranquilla',
    latitude: 11.0035,
    longitude: -74.8011,
  },

  // ── event_venue ───────────────────────────────────────────────────
  {
    slug: 'estadio-metropolitano',
    name: 'Estadio Metropolitano Roberto Melendez',
    description: 'Casa de la Seleccion Colombia y del Junior de Barranquilla.',
    category: 'event_venue',
    address: 'Calle 30 #44-12, Barranquilla',
    latitude: 10.9266,
    longitude: -74.8061,
  },
  {
    slug: 'coliseo-elias-chegwin',
    name: 'Coliseo Elias Chegwin',
    description:
      'Coliseo cubierto multipropósito, conciertos y eventos deportivos.',
    category: 'event_venue',
    address: 'Calle 72 #38-15, Barranquilla',
    latitude: 11.0001,
    longitude: -74.8043,
  },
  {
    slug: 'puerta-de-oro',
    name: 'Centro de Eventos Puerta de Oro',
    description: 'Principal centro de convenciones y eventos de la ciudad.',
    category: 'event_venue',
    address: 'Via 40 #79-900, Barranquilla',
    latitude: 11.0021,
    longitude: -74.8186,
  },
  {
    slug: 'teatro-amira-de-la-rosa',
    name: 'Teatro Amira de la Rosa',
    description:
      'Principal teatro de la ciudad para artes escenicas y conciertos.',
    category: 'event_venue',
    address: 'Carrera 54 #52-258, Barranquilla',
    latitude: 10.9866,
    longitude: -74.7886,
  },
  {
    slug: 'movich-buro-51',
    name: 'Movich Buro 51 Salon',
    description: 'Salon de eventos corporativos y sociales.',
    category: 'event_venue',
    address: 'Calle 76 #51B-28, Barranquilla',
    latitude: 11.0089,
    longitude: -74.8092,
  },
  {
    slug: 'country-club',
    name: 'Country Club Barranquilla',
    description: 'Club social y centro de eventos privados.',
    category: 'event_venue',
    address: 'Carrera 51B #82-46, Barranquilla',
    latitude: 11.0136,
    longitude: -74.8101,
  },
  {
    slug: 'salon-jumbo',
    name: 'Salon Jumbo',
    description: 'Salon de eventos para conciertos y fiestas privadas.',
    category: 'event_venue',
    address: 'Carrera 53 #75-100, Barranquilla',
    latitude: 10.9998,
    longitude: -74.8117,
  },
  {
    slug: 'club-cazadores',
    name: 'Club Cazadores',
    description: 'Club deportivo y social con salones para eventos.',
    category: 'event_venue',
    address: 'Carrera 64 #76-156, Barranquilla',
    latitude: 11.0058,
    longitude: -74.8164,
  },
];
