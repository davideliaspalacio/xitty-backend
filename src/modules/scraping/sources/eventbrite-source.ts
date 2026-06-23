import { Injectable, Logger } from '@nestjs/common';

import { RawItem, ScraperSource } from '../scraper-source.interface';

/**
 * EventbriteSource
 * ────────────────
 * Source pluggable que extrae eventos de la Eventbrite API v3 alrededor de
 * Barranquilla.
 *
 *   - Endpoint: `GET https://www.eventbriteapi.com/v3/events/search/`
 *   - Auth:     `Authorization: Bearer <EVENTBRITE_API_KEY>`
 *   - Config:   location_address, location_within_km, categories, max_results.
 *
 * Si la env `EVENTBRITE_API_KEY` NO esta seteada, la source NO falla:
 * `fetch()` devuelve 6 eventos mock plausibles dentro del bounding box de
 * Barranquilla. Esto permite arrancar el backend en entornos de dev/CI sin
 * obligar a configurar la API key real.
 */

/**
 * Config inyectable de la source. Todo opcional con defaults sensatos para
 * Barranquilla.
 */
export interface EventbriteSourceConfig {
  /** Direccion humana usada por Eventbrite como centro de busqueda. */
  location_address?: string;
  /** Radio en kilometros alrededor de la direccion. */
  location_within_km?: number;
  /**
   * Categorias slugs propios (food, music, arts, business, community, sports).
   * Se envian a Eventbrite como string separado por comas en `categories`.
   */
  categories?: string[];
  /** Limite duro de items devueltos por fetch(). Default 50. */
  max_results?: number;
  /** Permite apagar la source desde el module sin removerla. Default true. */
  enabled?: boolean;
}

const DEFAULT_CFG: Required<Omit<EventbriteSourceConfig, 'categories'>> & {
  categories: string[];
} = {
  location_address: 'Barranquilla, Colombia',
  location_within_km: 25,
  categories: [],
  max_results: 50,
  enabled: true,
};

const EVENTBRITE_API_BASE = 'https://www.eventbriteapi.com';

/** Shape minimo de la respuesta de Eventbrite que consumimos. */
interface EventbriteEvent {
  id?: string;
  name?: { text?: string };
  description?: { text?: string };
  url?: string;
  start?: { utc?: string };
  end?: { utc?: string };
  category_id?: string;
  venue?: {
    address?: {
      localized_address_display?: string;
      latitude?: string;
      longitude?: string;
    };
  };
  [k: string]: unknown;
}

interface EventbriteSearchResponse {
  events?: EventbriteEvent[];
  pagination?: { object_count?: number; has_more_items?: boolean };
}

@Injectable()
export class EventbriteSource implements ScraperSource {
  readonly id = 'eventbrite';
  readonly name = 'Eventbrite';
  readonly enabled: boolean;

  private readonly logger = new Logger(EventbriteSource.name);
  private readonly cfg: Required<Omit<EventbriteSourceConfig, 'categories'>> & {
    categories: string[];
  };

  constructor(cfg: EventbriteSourceConfig = {}) {
    this.cfg = {
      location_address: cfg.location_address ?? DEFAULT_CFG.location_address,
      location_within_km:
        cfg.location_within_km ?? DEFAULT_CFG.location_within_km,
      categories: cfg.categories ?? DEFAULT_CFG.categories,
      max_results: cfg.max_results ?? DEFAULT_CFG.max_results,
      enabled: cfg.enabled ?? DEFAULT_CFG.enabled,
    };
    this.enabled = this.cfg.enabled;
  }

  async fetch(): Promise<RawItem[]> {
    const token = process.env.EVENTBRITE_API_KEY;
    if (!token) {
      this.logger.warn(
        'EVENTBRITE_API_KEY no configurada — devolviendo 6 eventos mock.',
      );
      return this.mockItems();
    }

    const url = this.buildSearchUrl();
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      // 401/403 = token invalido o sin permisos, 5xx = caido.
      const body = await res.text().catch(() => '');
      throw new Error(
        `eventbrite api error ${res.status}: ${body.slice(0, 200)}`,
      );
    }

    const json = (await res.json()) as EventbriteSearchResponse;
    const events = Array.isArray(json.events) ? json.events : [];
    const mapped = events.map((e) => this.mapEvent(e));
    return mapped.slice(0, this.cfg.max_results);
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private buildSearchUrl(): string {
    const url = new URL('/v3/events/search/', EVENTBRITE_API_BASE);
    url.searchParams.set('location.address', this.cfg.location_address);
    url.searchParams.set(
      'location.within',
      `${this.cfg.location_within_km}km`,
    );
    // Necesario para que la respuesta incluya `venue` (lat/lng + address).
    url.searchParams.set('expand', 'venue');
    if (this.cfg.categories.length > 0) {
      url.searchParams.set('categories', this.cfg.categories.join(','));
    }
    return url.toString();
  }

  private mapEvent(e: EventbriteEvent): RawItem {
    const lat = e.venue?.address?.latitude;
    const lng = e.venue?.address?.longitude;
    return {
      external_id: e.id ?? `eventbrite-${Math.random().toString(36).slice(2)}`,
      name: e.name?.text ?? 'Evento sin titulo',
      description: e.description?.text ?? null,
      category: null,
      address: e.venue?.address?.localized_address_display ?? null,
      latitude: lat ? Number(lat) : null,
      longitude: lng ? Number(lng) : null,
      source_url: e.url ?? null,
      raw_payload: e as Record<string, unknown>,
    };
  }

  /**
   * 6 eventos plausibles dentro del bounding box de Barranquilla. Usados
   * cuando no hay API key — permiten que el runner haga un ciclo entero
   * sin tocar internet.
   */
  private mockItems(): RawItem[] {
    const samples: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      address: string;
      lat: number;
      lng: number;
    }> = [
      {
        id: 'mock-evt-1',
        name: 'Festival Gastronomico del Caribe',
        description:
          'Comida tipica de la costa, food trucks y musica en vivo en el Malecon.',
        category: 'food',
        address: 'Malecon del Rio, Barranquilla',
        lat: 10.9985,
        lng: -74.8076,
      },
      {
        id: 'mock-evt-2',
        name: 'Noche de Cumbia y Vallenato',
        description:
          'Concierto al aire libre con orquestas locales y bandas invitadas.',
        category: 'music',
        address: 'Parque Cultural del Caribe, Barranquilla',
        lat: 11.0049,
        lng: -74.7913,
      },
      {
        id: 'mock-evt-3',
        name: 'Expo Arte Joven Barranquilla',
        description:
          'Muestra colectiva de pintura, fotografia e instalaciones de artistas emergentes.',
        category: 'arts',
        address: 'Museo de Arte Moderno, Barranquilla',
        lat: 10.9956,
        lng: -74.8005,
      },
      {
        id: 'mock-evt-4',
        name: 'Networking Tech Caribe',
        description:
          'Encuentro de fundadores, devs y product managers del Caribe colombiano.',
        category: 'business',
        address: 'Coworking 84, Barranquilla',
        lat: 11.0083,
        lng: -74.8161,
      },
      {
        id: 'mock-evt-5',
        name: 'Mercado Campesino del Norte',
        description:
          'Productores locales venden frutas, verduras y artesanias todos los sabados.',
        category: 'community',
        address: 'Calle 82 con Carrera 53, Barranquilla',
        lat: 11.0044,
        lng: -74.8094,
      },
      {
        id: 'mock-evt-6',
        name: 'Carrera 10K Rio Magdalena',
        description:
          'Carrera popular con recorrido por la Via 40 y el Gran Malecon.',
        category: 'sports',
        address: 'Via 40, Barranquilla',
        lat: 10.9892,
        lng: -74.7857,
      },
    ];

    return samples.map((s) => ({
      external_id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      address: s.address,
      latitude: s.lat,
      longitude: s.lng,
      source_url: `https://www.eventbrite.com/e/${s.id}`,
      raw_payload: { mock: true, ...s },
    }));
  }
}
