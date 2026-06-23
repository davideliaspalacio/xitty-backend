import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import {
  ENRICHMENT_SERVICE,
  QUALITY_SERVICE,
  SCRAPER_SOURCES,
} from '../scraper-source.interface';
import type {
  EnrichedItem,
  EnrichmentService,
  QualityService,
  RawItem,
  ScraperSource,
  ScrapingRun,
} from '../scraper-source.interface';

/**
 * Orquestador del pipeline de scraping.
 *
 *   fetch  → guardar raw  → enrich  → quality  → dedup  → persistir
 *
 * Reglas de diseno:
 *  - Las metricas (items_found, items_enriched, items_failed, items_persisted,
 *    items_deduped) son la unica forma de saber si una corrida fue util.
 *  - Los errores de fetch se capturan y se reportan en el summary —
 *    runSource() NUNCA tira por un fetch fallido, asi runAll() puede seguir
 *    iterando.
 *  - Los errores en items individuales (enrichment, quality) tampoco detienen
 *    al runner: se cuentan en items_failed.
 *  - Persistencia es best-effort: si Supabase falla, se loguea y se cuenta como
 *    failed pero no rompe el pipeline.
 */
@Injectable()
export class RunnerService {
  private readonly logger = new Logger(RunnerService.name);

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
    @Inject(SCRAPER_SOURCES)
    private readonly sources: ScraperSource[],
    @Inject(ENRICHMENT_SERVICE)
    private readonly enrichment: EnrichmentService,
    @Inject(QUALITY_SERVICE)
    private readonly quality: QualityService,
  ) {}

  /**
   * Ejecuta el pipeline completo para una sola source.
   * Nunca tira por errores de runtime del pipeline — los reporta en el summary.
   * SI tira si el sourceId no existe o esta deshabilitado (caller error).
   */
  async runSource(sourceId: string): Promise<ScrapingRun> {
    const source = this.sources.find((s) => s.id === sourceId);
    if (!source) {
      throw new NotFoundException(`Scraper source not found: ${sourceId}`);
    }
    if (!source.enabled) {
      throw new NotFoundException(`Scraper source disabled: ${sourceId}`);
    }
    return this.executePipeline(source);
  }

  /**
   * Itera sobre todas las sources con enabled=true.
   * Cada source corre de forma aislada — si una falla, las demas siguen.
   */
  async runAll(): Promise<ScrapingRun[]> {
    const enabled = this.sources.filter((s) => s.enabled);
    if (enabled.length === 0) {
      this.logger.warn('runAll(): no scraper sources enabled');
      return [];
    }
    const runs: ScrapingRun[] = [];
    for (const source of enabled) {
      const run = await this.executePipeline(source);
      runs.push(run);
    }
    return runs;
  }

  // ── Pipeline interno ───────────────────────────────────────────────

  private async executePipeline(source: ScraperSource): Promise<ScrapingRun> {
    const startedAt = new Date();
    const startMs = Date.now();

    const summary: ScrapingRun = {
      source_id: source.id,
      started_at: startedAt.toISOString(),
      finished_at: startedAt.toISOString(), // placeholder, se setea al final
      duration_ms: 0,
      items_found: 0,
      items_enriched: 0,
      items_failed: 0,
      items_persisted: 0,
      items_deduped: 0,
      errored: false,
    };

    // 1) FETCH ────────────────────────────────────────────────────────
    let rawItems: RawItem[];
    try {
      rawItems = await source.fetch();
      summary.items_found = rawItems.length;
    } catch (err: any) {
      summary.errored = true;
      summary.error_message = err?.message ?? String(err);
      this.logger.error(
        `[${source.id}] fetch() failed: ${summary.error_message}`,
      );
      return this.finalize(summary, startMs);
    }

    if (rawItems.length === 0) {
      this.logger.log(`[${source.id}] fetch() returned 0 items`);
      return this.finalize(summary, startMs);
    }

    // 2) GUARDAR RAW — best-effort, no detiene el pipeline ──────────
    await this.persistRaw(source.id, rawItems).catch((err) => {
      this.logger.warn(
        `[${source.id}] persistRaw failed (continuing): ${err?.message ?? err}`,
      );
    });

    // 3) ENRICH + QUALITY + DEDUP + PERSIST por item ─────────────────
    const enrichedItems: EnrichedItem[] = [];
    for (const raw of rawItems) {
      try {
        const enriched = await this.enrichment.enrich(raw);
        if (!enriched) {
          summary.items_failed += 1;
          continue;
        }
        summary.items_enriched += 1;

        const q = await this.quality.score(enriched);
        enriched.quality_score = q.score;
        enriched.quality_reason = q.reason;

        if (!q.passes) {
          continue; // no se persiste, pero no es failed — fue evaluado
        }

        enrichedItems.push(enriched);
      } catch (err: any) {
        summary.items_failed += 1;
        this.logger.warn(
          `[${source.id}] item "${raw.external_id}" failed: ${err?.message ?? err}`,
        );
      }
    }

    // 4) DEDUP + PERSIST en bloque ──────────────────────────────────
    if (enrichedItems.length > 0) {
      const { persisted, deduped } = await this.dedupAndPersist(
        source.id,
        enrichedItems,
      ).catch((err) => {
        this.logger.error(
          `[${source.id}] dedupAndPersist failed: ${err?.message ?? err}`,
        );
        return { persisted: 0, deduped: 0 };
      });
      summary.items_persisted = persisted;
      summary.items_deduped = deduped;
    }

    return this.finalize(summary, startMs);
  }

  private finalize(summary: ScrapingRun, startMs: number): ScrapingRun {
    const finishedAt = new Date();
    summary.finished_at = finishedAt.toISOString();
    summary.duration_ms = Date.now() - startMs;
    this.logger.log(
      `[${summary.source_id}] done in ${summary.duration_ms}ms — ` +
      `found=${summary.items_found} enriched=${summary.items_enriched} ` +
      `failed=${summary.items_failed} persisted=${summary.items_persisted} ` +
      `deduped=${summary.items_deduped} errored=${summary.errored}`,
    );
    return summary;
  }

  /**
   * Guarda los raw items para auditoria. Tabla `scraping_raw_items` (creada
   * en migracion aparte). Si la tabla no existe, el error se captura arriba.
   */
  private async persistRaw(
    sourceId: string,
    items: RawItem[],
  ): Promise<void> {
    const rows = items.map((i) => ({
      source_id: sourceId,
      external_id: i.external_id,
      payload: i,
    }));
    const { error } = await this.supabase
      .from('scraping_raw_items')
      .insert(rows);
    if (error) throw new Error(error.message);
  }

  /**
   * Upsert por (source_id, external_id) en `scraping_enriched_items`.
   * Devuelve cuantos se insertaron como nuevos vs cuantos se considera deduped.
   *
   * Heuristica MVP de dedup: contamos como "deduped" los items que ya existian
   * con el mismo external_id (el upsert los actualiza igual).
   *
   * NOTA: matching mas inteligente (por nombre normalizado + proximidad
   * geografica contra `places`) se implementara en un step posterior.
   */
  private async dedupAndPersist(
    sourceId: string,
    items: EnrichedItem[],
  ): Promise<{ persisted: number; deduped: number }> {
    const externalIds = items.map((i) => i.external_id);

    // Cuales ya existian? (count para metricas, antes del upsert)
    let existingCount = 0;
    try {
      const { data: existing } = await this.supabase
        .from('scraping_enriched_items')
        .select('external_id')
        .eq('source_id', sourceId)
        .in('external_id', externalIds);
      existingCount = existing?.length ?? 0;
    } catch {
      // si select falla, asumimos 0 ya existentes — el upsert sigue adelante
    }

    const rows = items.map((i) => ({
      source_id: sourceId,
      external_id: i.external_id,
      name: i.name,
      description: i.description,
      category: i.category,
      address: i.address,
      latitude: i.latitude,
      longitude: i.longitude,
      quality_score: i.quality_score,
      quality_reason: i.quality_reason,
      payload: i.raw_payload ?? null,
    }));

    const { error } = await this.supabase
      .from('scraping_enriched_items')
      .upsert(rows, { onConflict: 'source_id,external_id' });
    if (error) throw new Error(error.message);

    return {
      persisted: items.length,
      deduped: existingCount,
    };
  }
}
