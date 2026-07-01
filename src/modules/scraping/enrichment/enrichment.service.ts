import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  ENRICHMENT_PROVIDER,
  type EnrichmentProvider,
  type SourceKind,
} from './providers/enrichment-provider.interface';
import {
  QualityScorerService,
  type QualitySignals,
} from './quality-scorer.service';
import { DedupService } from './dedup.service';
import {
  llmEnrichedItemSchema,
  LlmEnrichedItem,
  EnrichedItem,
} from './schema/enriched-item.schema';

/**
 * Resultado final que devuelve enrich(): item enriquecido + metadata de dedup.
 */
export interface EnrichmentResult extends EnrichedItem {
  is_duplicate: boolean;
  duplicate_of: string | null;
}

/**
 * Orquesta el pipeline:
 *   raw payload → prompt → LLM → JSON parse → zod validate → quality + hash → dedup check.
 *
 * Pluggable: el provider se inyecta via ENRICHMENT_PROVIDER token (mock | openai).
 */
@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);
  private readonly maxRetries = 2; // 1 intento inicial + 2 retries = 3 calls max

  constructor(
    @Inject(ENRICHMENT_PROVIDER)
    private readonly provider: EnrichmentProvider,
    private readonly scorer: QualityScorerService,
    private readonly dedup: DedupService,
  ) {}

  async enrich(
    rawPayload: unknown,
    sourceKind: SourceKind,
    signals: QualitySignals = {},
  ): Promise<EnrichmentResult> {
    const prompt = this.buildPrompt(rawPayload, sourceKind);

    let lastError: string | null = null;
    let parsed: LlmEnrichedItem | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const raw = await this.provider.generate(
          this.augmentPromptForRetry(prompt, lastError, attempt),
        );
        const json = this.safeJsonParse(raw);
        if (!json) {
          lastError = 'response was not valid JSON';
          this.logger.warn(`[attempt ${attempt + 1}] ${lastError}`);
          continue;
        }
        const validated = llmEnrichedItemSchema.safeParse(json);
        if (!validated.success) {
          lastError = `schema validation failed: ${validated.error.message}`;
          this.logger.warn(`[attempt ${attempt + 1}] ${lastError}`);
          continue;
        }
        parsed = validated.data;
        break;
      } catch (err: any) {
        lastError = err?.message ?? 'unknown provider error';
        this.logger.warn(`[attempt ${attempt + 1}] provider error: ${lastError}`);
      }
    }

    if (!parsed) {
      throw new BadRequestException(
        `Enrichment failed after ${this.maxRetries + 1} attempts: ${lastError ?? 'unknown'}`,
      );
    }

    // Calcular score (texto IA + señales de realidad de la fuente) y hash
    const quality_score = this.scorer.score(parsed, signals);
    const raw_hash = this.dedup.computeHash(parsed);

    // Dedup lookup (best-effort)
    const existing = await this.dedup.findDuplicate(raw_hash);

    return {
      ...parsed,
      quality_score,
      source_kind: sourceKind,
      raw_hash,
      is_duplicate: !!existing,
      duplicate_of: existing?.id ?? null,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // helpers
  // ──────────────────────────────────────────────────────────────────────

  private buildPrompt(rawPayload: unknown, sourceKind: SourceKind): string {
    const snippet =
      typeof rawPayload === 'string'
        ? rawPayload
        : JSON.stringify(rawPayload, null, 2);

    return [
      'Eres un curador de turismo del Caribe colombiano. Recibes un snippet',
      `scrapeado de [${sourceKind}]. Tu tarea es SOLO NORMALIZAR el texto a JSON,`,
      'NO buscar datos nuevos ni inventar imágenes, precios ni horarios.',
      '',
      'Reglas:',
      '  - title: nombre limpio y legible del lugar/evento.',
      '  - description: 1-2 frases cálidas y útiles en español caribeño, basadas',
      '    SOLO en el snippet. Si el snippet no da para una descripción real, null.',
      '  - category_hint: clasifica el segmento en una palabra: "restaurante",',
      '    "lugar" (atracción/sitio) o "evento". Usa el tipo del snippet si viene.',
      '  - Si un lugar NO parece real, activo o útil para un turista, devuelve',
      '    title igual pero description null (el pipeline lo filtrará por calidad).',
      '  - NO inventes lat/lng/precio/horario: si no están en el snippet, null.',
      '',
      'El JSON debe tener EXACTAMENTE estos campos:',
      '  title (string, requerido)',
      '  description (string|null, max 500 chars)',
      '  category_hint (string|null) — "restaurante" | "lugar" | "evento"',
      '  location_name (string|null)',
      '  lat (number|null)',
      '  lng (number|null)',
      '  starts_at (ISO 8601 string|null)',
      '  ends_at (ISO 8601 string|null)',
      '  price_cop (number|null) — en pesos colombianos',
      '',
      'Snippet:',
      snippet,
    ].join('\n');
  }

  private augmentPromptForRetry(
    base: string,
    lastError: string | null,
    attempt: number,
  ): string {
    if (attempt === 0 || !lastError) return base;
    return (
      base +
      `\n\n[RETRY ${attempt}] Tu respuesta anterior fallo: ${lastError}.\n` +
      'Devuelve SOLO un JSON valido conforme al schema. Sin texto antes ni despues.'
    );
  }

  private safeJsonParse(raw: string): unknown | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Caso comun: el LLM envuelve el JSON en ```json ... ``` aun pidiendole JSON puro
    const cleaned = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}
