/**
 * Interfaz pluggable de SOURCE para el pipeline de scraping.
 *
 * Cada adapter concreto (Google Places, TripAdvisor, eventos locales, etc.)
 * implementa `Source<TConfig>` y queda registrado en el `SchedulerModule`.
 *
 * Difiere de `ScraperSource` (en `../scraper-source.interface.ts`) en que aqui
 * el fetch acepta una `config` parametrizable — el caller decide la zona, el
 * tipo, el radio, etc. `ScraperSource` es la version "registrada" (id +
 * enabled + fetch sin args) que el runner orquesta.
 *
 * REGLA: las API keys son SIEMPRE opcionales. Si una source no tiene la key
 * configurada, debe devolver mock data en lugar de tirar excepcion.
 */
import type { RawItem } from '../scraper-source.interface';

export type SourceKind = string;

/**
 * Adapter pluggable. La generic `TConfig` permite que cada source declare su
 * propia forma de configuracion (lat/lng/radius/type para Google Places, url
 * para un scraper de sitio, etc.) sin perder type-safety.
 */
export interface Source<TConfig = Record<string, unknown>> {
  /** Identificador estable del adapter (e.g. 'google-places', 'tripadvisor'). */
  readonly kind: SourceKind;

  /**
   * Extrae items crudos segun la config provista.
   * Debe ser idempotente y NO lanzar por falta de API key — en ese caso
   * devuelve mock data plausible para que el pipeline pueda correr en dev.
   */
  fetch(config: TConfig): Promise<RawItem[]>;
}
