import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { ScrapingRunsRepo } from '../storage/scraping-runs.repo';
import { ScrapedItemsRepo } from '../storage/scraped-items.repo';
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

/** Quien dispara un run cuando el caller no lo especifica. */
const DEFAULT_TRIGGERED_BY = 'manual';

/**
 * Orquestador del pipeline de scraping.
 *
 *   start run → fetch → insertRaw (dedup) → enrich → quality → insertEnriched → finish run
 *
 * Persistencia (fuente de verdad: migracion 20260619000001_create_scraping_tables):
 *  - `scraping_runs`          via ScrapingRunsRepo  (start / finish / error)
 *  - `scraped_items_raw`      via ScrapedItemsRepo.insertRaw  (dedup por dedup_hash)
 *  - `scraped_items_enriched` via ScrapedItemsRepo.insertEnriched (status='pending')
 *
 * El item enriquecido queda en estado `pending`, que es lo que lee la cola de
 * moderacion del admin y, una vez `published`, el feed "Descubre lo nuevo".
 *
 * Reglas de diseno:
 *  - Las metricas (items_found, items_enriched, items_failed, items_persisted,
 *    items_deduped) son la unica forma de saber si una corrida fue util.
 *  - Los errores de fetch se capturan, se reportan en el summary y marcan el run
 *    como `failed` — runSource() NUNCA tira por un fetch fallido, asi runAll()
 *    puede seguir iterando.
 *  - Los errores en items individuales (insertRaw, enrichment, quality) tampoco
 *    detienen al runner: se cuentan en items_failed.
 *  - El dedup lo resuelve el unique index `dedup_hash`: insertRaw() devuelve
 *    `null` cuando el item ya existia (no es failed, es deduped).
 */
@Injectable()
export class RunnerService {
  private readonly logger = new Logger(RunnerService.name);

  constructor(
    @Inject(SCRAPER_SOURCES)
    private readonly sources: ScraperSource[],
    @Inject(ENRICHMENT_SERVICE)
    private readonly enrichment: EnrichmentService,
    @Inject(QUALITY_SERVICE)
    private readonly quality: QualityService,
    private readonly runsRepo: ScrapingRunsRepo,
    private readonly itemsRepo: ScrapedItemsRepo,
  ) {}

  /**
   * Ejecuta el pipeline completo para una sola source.
   * Nunca tira por errores de runtime del pipeline — los reporta en el summary.
   * SI tira si el sourceId no existe o esta deshabilitado (caller error).
   */
  async runSource(
    sourceId: string,
    triggeredBy: string = DEFAULT_TRIGGERED_BY,
  ): Promise<ScrapingRun> {
    const source = this.sources.find((s) => s.id === sourceId);
    if (!source) {
      throw new NotFoundException(`Scraper source not found: ${sourceId}`);
    }
    if (!source.enabled) {
      throw new NotFoundException(`Scraper source disabled: ${sourceId}`);
    }
    return this.executePipeline(source, triggeredBy);
  }

  /**
   * Itera sobre todas las sources con enabled=true.
   * Cada source corre de forma aislada — si una falla, las demas siguen.
   */
  async runAll(
    triggeredBy: string = DEFAULT_TRIGGERED_BY,
  ): Promise<ScrapingRun[]> {
    const enabled = this.sources.filter((s) => s.enabled);
    if (enabled.length === 0) {
      this.logger.warn('runAll(): no scraper sources enabled');
      return [];
    }
    const runs: ScrapingRun[] = [];
    for (const source of enabled) {
      const run = await this.executePipeline(source, triggeredBy);
      runs.push(run);
    }
    return runs;
  }

  // ── Pipeline interno ───────────────────────────────────────────────

  private async executePipeline(
    source: ScraperSource,
    triggeredBy: string,
  ): Promise<ScrapingRun> {
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

    // 0) REGISTRAR EL RUN en scraping_runs ────────────────────────────
    const run = await this.runsRepo.start(source.id, triggeredBy);
    const runId = run.id;

    // 1) FETCH ────────────────────────────────────────────────────────
    let rawItems: RawItem[];
    try {
      rawItems = await source.fetch();
      summary.items_found = rawItems.length;
    } catch (err: unknown) {
      summary.errored = true;
      summary.error_message = errorMessage(err);
      this.logger.error(
        `[${source.id}] fetch() failed: ${summary.error_message}`,
      );
      await this.runsRepo.error(runId, summary.error_message ?? 'fetch failed');
      return this.finalize(summary, startMs);
    }

    if (rawItems.length === 0) {
      this.logger.log(`[${source.id}] fetch() returned 0 items`);
      await this.finishRun(runId, summary);
      return this.finalize(summary, startMs);
    }

    // 2) Por item: insertRaw (dedup) → enrich → quality → insertEnriched
    for (const raw of rawItems) {
      try {
        // 2a) Persistir raw — devuelve null si es un duplicado (dedup_hash).
        const rawRow = await this.itemsRepo.insertRaw({
          runId,
          sourceId: source.id,
          sourceUrl: raw.source_url ?? '',
          sourceExternalId: raw.external_id ?? null,
          payload: (raw.raw_payload as Record<string, any>) ?? { ...raw },
        });

        if (!rawRow) {
          summary.items_deduped += 1;
          continue;
        }

        // 2b) Enrich
        const enriched = await this.enrichment.enrich(raw);
        if (!enriched) {
          summary.items_failed += 1;
          continue;
        }
        summary.items_enriched += 1;

        // 2c) Quality
        const q = await this.quality.score(enriched);
        enriched.quality_score = q.score;
        enriched.quality_reason = q.reason;

        if (!q.passes) {
          continue; // evaluado pero no persiste — no es failed
        }

        // 2d) Persistir enriched (status='pending', cola de moderacion)
        await this.itemsRepo.insertEnriched(
          this.toEnrichedInput(rawRow.id, enriched),
        );
        summary.items_persisted += 1;
      } catch (err: unknown) {
        summary.items_failed += 1;
        this.logger.warn(
          `[${source.id}] item "${raw.external_id}" failed: ${errorMessage(err)}`,
        );
      }
    }

    await this.finishRun(runId, summary);
    return this.finalize(summary, startMs);
  }

  /**
   * Mapea un EnrichedItem (forma del pipeline) al InsertEnrichedInput del repo
   * (forma de la tabla scraped_items_enriched).
   */
  private toEnrichedInput(rawId: string, e: EnrichedItem) {
    return {
      rawId,
      title: e.name,
      description: e.description ?? null,
      categoryHint: e.category ?? null,
      locationName: e.address ?? null,
      lat: e.latitude ?? null,
      lng: e.longitude ?? null,
      sourceUrl: e.source_url ?? null,
      qualityScore: e.quality_score ?? null,
    };
  }

  /**
   * Finaliza el run en DB. `partial` si hubo items fallidos, `succeeded` si todo
   * salio bien. Best-effort: si el update falla, se loguea pero no rompe.
   */
  private async finishRun(runId: string, summary: ScrapingRun): Promise<void> {
    const status = summary.items_failed > 0 ? 'partial' : 'succeeded';
    try {
      await this.runsRepo.finish(runId, {
        status,
        itemsFound: summary.items_found,
        itemsEnriched: summary.items_enriched,
        itemsFailed: summary.items_failed,
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[${summary.source_id}] finish(${runId}) failed (ignored): ${errorMessage(err)}`,
      );
    }
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
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}
