import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { EnrichmentProvider } from './enrichment-provider.interface';

/**
 * Provider real de enrichment usando la API de OpenAI con JSON mode
 * (response_format: json_object) — el modelo SIEMPRE devuelve JSON parseable,
 * que el EnrichmentService valida luego con zod.
 *
 * Lazy-init: si OPENAI_API_KEY no esta seteada en runtime, tira
 * ServiceUnavailableException y el service hace fallback a mock.
 * Modelo por defecto: gpt-4o-mini. Configurable via OPENAI_ENRICHMENT_MODEL.
 */
@Injectable()
export class OpenAIEnrichmentProvider implements EnrichmentProvider {
  private readonly logger = new Logger(OpenAIEnrichmentProvider.name);
  private client: OpenAI | null = null;
  private readonly modelName =
    process.env.OPENAI_ENRICHMENT_MODEL ||
    process.env.OPENAI_MODEL ||
    'gpt-4o-mini';

  private getClient(): OpenAI {
    if (this.client) return this.client;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Enrichment AI provider not configured: missing OPENAI_API_KEY',
      );
    }
    this.client = new OpenAI({ apiKey });
    return this.client;
  }

  async generate(prompt: string): Promise<string> {
    const client = this.getClient();
    try {
      const completion = await client.chat.completions.create({
        model: this.modelName,
        // JSON mode: garantiza salida JSON valida. El prompt ya describe los
        // campos esperados; el EnrichmentService valida la forma con zod.
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 800,
        messages: [
          {
            role: 'system',
            content:
              'Devuelves UNICAMENTE un objeto JSON con los campos solicitados. ' +
              'Usa null cuando no puedas inferir un campo. No inventes precios ni horarios.',
          },
          { role: 'user', content: prompt },
        ],
      });
      const text = completion.choices[0]?.message?.content;
      if (!text || !text.trim()) {
        throw new Error('empty response from openai');
      }
      return text;
    } catch (err: any) {
      this.logger.error(
        `OpenAI enrichment failed: ${err?.message ?? 'unknown error'}`,
      );
      throw new ServiceUnavailableException(
        'Enrichment AI temporalmente no disponible.',
      );
    }
  }
}
