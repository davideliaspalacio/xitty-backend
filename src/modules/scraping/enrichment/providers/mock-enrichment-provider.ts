import { Injectable } from '@nestjs/common';
import { EnrichmentProvider } from './enrichment-provider.interface';

/**
 * Mock provider para tests y para desarrollo local sin OPENAI_API_KEY.
 *
 * Devuelve un EnrichedItem "canned" en formato JSON conforme al schema.
 * Se puede configurar el next() para devolver un JSON arbitrario en tests
 * (por ej. JSON invalido para probar retry, o item parcial para probar quality).
 */
@Injectable()
export class MockEnrichmentProvider implements EnrichmentProvider {
  private queue: string[] = [];

  /**
   * Encola una respuesta para la proxima llamada a generate().
   * Si la queue esta vacia, generate() devuelve un item canned por defecto.
   */
  enqueueResponse(payload: string): void {
    this.queue.push(payload);
  }

  resetQueue(): void {
    this.queue = [];
  }

  generate(): Promise<string> {
    if (this.queue.length > 0) {
      return Promise.resolve(this.queue.shift()!);
    }
    return Promise.resolve(
      JSON.stringify({
        title: 'Carnaval de Barranquilla (mock)',
        description:
          'Fiesta tradicional del Caribe colombiano declarada Patrimonio Cultural Inmaterial. Mock generado para tests sin OPENAI_API_KEY configurada.',
        category_hint: 'festival',
        location_name: 'Vía 40',
        lat: 10.9685,
        lng: -74.7813,
        starts_at: '2026-02-14T08:00:00Z',
        ends_at: '2026-02-17T22:00:00Z',
        price_cop: null,
        image_url: null,
      }),
    );
  }
}
