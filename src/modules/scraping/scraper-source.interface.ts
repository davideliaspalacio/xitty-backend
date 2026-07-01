/**
 * Interfaces compartidas del modulo scraping.
 *
 * El scraping en Xitty es un pipeline de 4 etapas:
 *   1. SOURCE       — cada source (TripAdvisor, Google Places, eventos locales, etc.)
 *                     implementa `ScraperSource` y devuelve `RawItem[]`.
 *   2. ENRICHMENT   — completa campos faltantes (geocoding, descripciones via LLM,
 *                     fotos, horarios) y produce `EnrichedItem`.
 *   3. QUALITY      — score 0..1 que indica si el item vale la pena persistir.
 *   4. DEDUP        — colapsa duplicados contra lo ya guardado (matching por nombre
 *                     normalizado + proximidad geografica).
 *
 * El RUNNER orquesta las 4 etapas y devuelve un `ScrapingRun` con metricas.
 *
 * REGLA: las API keys son SIEMPRE opcionales. Si una source no tiene la key
 * configurada, debe devolver mock data en lugar de tirar excepcion al boot.
 */

/**
 * Token de inyeccion para la lista de sources registradas en el sistema.
 * El SchedulerModule lo provee como `ScraperSource[]`.
 */
export const SCRAPER_SOURCES = 'SCRAPER_SOURCES';

/**
 * Token de inyeccion para el servicio de enrichment.
 */
export const ENRICHMENT_SERVICE = 'ENRICHMENT_SERVICE';

/**
 * Token de inyeccion para el servicio de quality scoring.
 */
export const QUALITY_SERVICE = 'QUALITY_SERVICE';

/**
 * Item crudo tal cual lo devuelve una source. Campos minimos para que dedup
 * funcione (nombre, lat/lng aproximados). El resto es opcional y se rellena
 * en enrichment.
 */
export interface RawItem {
  /** Identificador estable dentro del source (slug, id externo, hash de url). */
  external_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** URL original de la que se extrajo el item — util para auditoria. */
  source_url?: string | null;
  /**
   * Datos DETERMINISTAS que la fuente ya conoce (NO los infiere la IA):
   *   - image_url:    URL de la foto en la fuente. Se re-hospeda en Storage
   *                   antes de exponerla (puede llevar la API key / expirar).
   *   - rating:       calificacion 0..5 de la fuente.
   *   - review_count: cantidad de resenas — senal de "lugar real y activo".
   */
  image_url?: string | null;
  rating?: number | null;
  review_count?: number | null;
  /** Payload arbitrario que la source quiera persistir para debug / re-enrich. */
  raw_payload?: Record<string, unknown>;
}

/**
 * Item ya enriquecido y con score de calidad. Listo para upsert en `places`
 * (o donde corresponda segun la source).
 */
export interface EnrichedItem extends RawItem {
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  /** Score 0..1 — items con score < threshold se descartan en la etapa quality. */
  quality_score: number;
  /** Razon humana del score, util para debugging. */
  quality_reason?: string;
}

/**
 * Source pluggable. Cada implementacion concreta (TripAdvisorSource,
 * GooglePlacesSource, EventosBarranquillaSource, etc.) implementa esta interfaz.
 */
export interface ScraperSource {
  /** Identificador unico, usado para logs y para `runSource(sourceId)`. */
  readonly id: string;
  /** Nombre humano para mostrar en UI/logs. */
  readonly name: string;
  /** `false` desactiva la source del runAll() sin tener que removerla del module. */
  readonly enabled: boolean;
  /** Extrae items crudos. Puede tirar — el runner captura y reporta. */
  fetch(): Promise<RawItem[]>;
}

/**
 * Servicio que enriquece un RawItem.
 * Devuelve `null` si el item no se puede enriquecer (datos insuficientes).
 */
export interface EnrichmentService {
  enrich(item: RawItem): Promise<EnrichedItem | null>;
}

/**
 * Servicio que asigna un score de calidad y decide si el item pasa el threshold.
 */
export interface QualityService {
  score(item: EnrichedItem): Promise<{ score: number; reason: string; passes: boolean }>;
}

/**
 * Resumen de una ejecucion del runner — se devuelve por runSource() y se puede
 * agregar para el runAll().
 */
export interface ScrapingRun {
  source_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  items_found: number;
  items_enriched: number;
  items_failed: number;
  items_persisted: number;
  items_deduped: number;
  /** `true` si la source.fetch() o el flujo entero fallo. */
  errored: boolean;
  error_message?: string;
}
