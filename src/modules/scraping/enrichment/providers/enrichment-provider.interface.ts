/**
 * Token de inyeccion para el provider del LLM de enrichment.
 * El module decide cual implementacion proveer segun NODE_ENV y OPENAI_API_KEY.
 */
export const ENRICHMENT_PROVIDER = 'ENRICHMENT_PROVIDER';

/**
 * Hint de la fuente del scraping. El service lo usa para variar el prompt
 * (instagram vs. eventbrite vs. site-oficial tienen diferente estructura).
 */
export type SourceKind = string;

/**
 * Output crudo del LLM: SIEMPRE un string que esperamos sea JSON parseable
 * conforme al `llmResponseSchema`. El parseo + validacion zod lo hace el
 * EnrichmentService — el provider solo se encarga de la I/O.
 */
export interface EnrichmentProvider {
  /**
   * @param prompt el prompt completo (system + payload) ya armado por el service.
   * @returns texto crudo del LLM (esperado: JSON).
   */
  generate(prompt: string): Promise<string>;
}
