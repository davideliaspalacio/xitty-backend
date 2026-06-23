import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { EnrichmentProvider } from './enrichment-provider.interface';

/**
 * Provider real usando @google/generative-ai con modelo gemini-1.5-flash y
 * structured output (responseSchema) — el modelo SIEMPRE devuelve JSON
 * conforme al schema, lo que minimiza errores de parseo.
 *
 * Lazy-init del cliente: si GEMINI_API_KEY no esta seteada en runtime,
 * tira ServiceUnavailableException — el service hace fallback a mock.
 */
@Injectable()
export class GeminiEnrichmentProvider implements EnrichmentProvider {
  private readonly logger = new Logger(GeminiEnrichmentProvider.name);
  private client: GoogleGenerativeAI | null = null;
  private readonly modelName =
    process.env.GEMINI_ENRICHMENT_MODEL ||
    process.env.GEMINI_MODEL ||
    'gemini-1.5-flash';

  private getClient(): GoogleGenerativeAI {
    if (this.client) return this.client;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Enrichment AI provider not configured: missing GEMINI_API_KEY',
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
    return this.client;
  }

  async generate(prompt: string): Promise<string> {
    const client = this.getClient();
    const model = client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING, nullable: true },
            category_hint: { type: SchemaType.STRING, nullable: true },
            location_name: { type: SchemaType.STRING, nullable: true },
            lat: { type: SchemaType.NUMBER, nullable: true },
            lng: { type: SchemaType.NUMBER, nullable: true },
            starts_at: { type: SchemaType.STRING, nullable: true },
            ends_at: { type: SchemaType.STRING, nullable: true },
            price_cop: { type: SchemaType.NUMBER, nullable: true },
            image_url: { type: SchemaType.STRING, nullable: true },
          },
          required: ['title'],
        },
      },
    });

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (!text || !text.trim()) {
        throw new Error('empty response from gemini');
      }
      return text;
    } catch (err: any) {
      this.logger.error(
        `Gemini enrichment failed: ${err?.message ?? 'unknown error'}`,
      );
      throw new ServiceUnavailableException(
        'Enrichment AI temporalmente no disponible.',
      );
    }
  }
}
