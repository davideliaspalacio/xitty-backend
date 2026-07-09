import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { ScrapingSourcesRepo } from '../storage/scraping-sources.repo';
import { ScrapingRun, ScrapingRunsRepo } from '../storage/scraping-runs.repo';
import { ScrapedItemsRepo } from '../storage/scraped-items.repo';
import { PhotoStorageService } from '../storage/photo-storage.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { ScraperSourceFactory } from '../sources/source.factory';
import type { RawItem } from '../scraper-source.interface';

/**
 * ScrapingExecutorService
 * ───────────────────────
 * Orquestador REAL del pipeline de scraping para un run manual (o cron).
 *
 * A diferencia del viejo `RunnerService` (que buscaba en un array en memoria y
 * persistia en tablas inexistentes), este executor trabaja 100% contra la DB:
 *
 *   scraping_sources (por UUID)
 *      → scraping_runs.start()
 *      → source.fetch()                       (impl. concreta segun `kind`)
 *      → scraped_items_raw.insertRaw()         (dedup por dedup_hash)
 *      → EnrichmentService.enrich()            (LLM real o mock sin API key)
 *      → scraped_items_enriched.insertEnriched (status='pending' → moderacion)
 *      → scraping_runs.finish() / error()
 *      → scraping_sources.markRun()
 *
 * Reglas:
 *  - Si la source no existe en la DB → 404 (lo tira `sourcesRepo.findById`).
 *  - Si esta `enabled=false` → 400.
 *  - Un fallo de `fetch()` marca el run como `failed` y se re-lanza.
 *  - Un fallo en un item individual (enrichment/persist) NO detiene el run:
 *    se cuenta en `items_failed` y el run termina `partial`.
 */
@Injectable()
export class ScrapingExecutorService {
  private readonly logger = new Logger(ScrapingExecutorService.name);

  constructor(
    private readonly sourcesRepo: ScrapingSourcesRepo,
    private readonly runsRepo: ScrapingRunsRepo,
    private readonly itemsRepo: ScrapedItemsRepo,
    private readonly enrichment: EnrichmentService,
    private readonly factory: ScraperSourceFactory,
    private readonly photos: PhotoStorageService,
  ) {}

  /**
   * Ejecuta el pipeline completo para una source identificada por su UUID de DB.
   * Devuelve la fila final de `scraping_runs` con las metricas del run.
   */
  async runSource(sourceId: string, triggeredBy: string): Promise<ScrapingRun> {
    // 404 si la source no existe en la DB (mensaje del repo).
    const source = await this.sourcesRepo.findById(sourceId);
    if (!source.enabled) {
      throw new BadRequestException(
        `La source "${source.name}" esta deshabilitada (enabled=false)`,
      );
    }

    // Puede tirar 501 (kind no implementado) o 400 (config invalida) ANTES de
    // crear el run — asi no dejamos runs huerfanos en estado 'running'.
    const fetcher = this.factory.build(source);

    const run = await this.runsRepo.start(sourceId, triggeredBy);
    this.logger.log(
      `run=${run.id} source=${sourceId} kind=${source.kind} triggered_by=${triggeredBy}`,
    );

    let rawItems: RawItem[];
    try {
      rawItems = await fetcher.fetch();
    } catch (err: unknown) {
      const message = `fetch() fallo: ${errorMessage(err)}`;
      this.logger.error(`run=${run.id} ${message}`);
      await this.runsRepo.error(run.id, message);
      throw new BadRequestException(message);
    }

    let itemsEnriched = 0;
    let itemsFailed = 0;
    let itemsWithImage = 0;

    // Observabilidad: qué se buscó y dónde (config de la source) + cuántos volvieron.
    this.logger.log(
      `run=${run.id} source="${source.name}" kind=${source.kind} ` +
        `config=${JSON.stringify(source.config ?? {})} → fetch trajo ${rawItems.length} items`,
    );

    for (const raw of rawItems) {
      try {
        const sourceUrl =
          raw.source_url ?? `urn:${source.kind}:${raw.external_id}`;

        const rawRow = await this.itemsRepo.insertRaw({
          runId: run.id,
          sourceId,
          sourceUrl,
          sourceExternalId: raw.external_id,
          payload: raw as Record<string, any>,
        });

        // null = dedup hit a nivel raw (ya scrapeado antes) → no es failure.
        if (!rawRow) continue;

        // La IA solo normaliza texto; le pasamos las señales DETERMINISTAS de la
        // fuente (rating, nº reseñas, si hay foto) para el score de "realidad".
        const enriched = await this.enrichment.enrich(
          rawRow.raw_payload,
          source.kind,
          {
            rating: raw.rating ?? null,
            reviewCount: raw.review_count ?? null,
            hasImage: !!raw.image_url,
          },
        );

        // dedup a nivel enriched: ya existe un item equivalente.
        if (enriched.is_duplicate) continue;

        // Re-hospedamos la foto de la fuente en Storage (URL propia estable, sin
        // exponer la key). Best-effort: si falla, el item queda sin imagen.
        let imageUrl: string | null = null;
        if (raw.image_url) {
          imageUrl = await this.photos.rehost(
            raw.image_url,
            `${source.kind}/${raw.external_id}`,
          );
          if (imageUrl) itemsWithImage += 1;
        }

        await this.itemsRepo.insertEnriched({
          rawId: rawRow.id,
          title: enriched.title,
          description: enriched.description ?? null,
          categoryHint: enriched.category_hint ?? null,
          // La dirección REAL viene de la fuente (Google formattedAddress), no
          // del texto que reescribe la IA — si la fuente la trae, mandamos esa.
          locationName: raw.address ?? enriched.location_name ?? null,
          lat: enriched.lat ?? null,
          lng: enriched.lng ?? null,
          startsAt: enriched.starts_at ?? null,
          endsAt: enriched.ends_at ?? null,
          priceCop: enriched.price_cop ?? null,
          imageUrl,
          rating: raw.rating ?? null,
          reviewCount: raw.review_count ?? null,
          // Perfil de contacto/negocio, determinista de la fuente:
          phone: raw.phone ?? null,
          website: raw.website ?? null,
          openingHours: raw.opening_hours ?? null,
          priceLevel: raw.price_level ?? null,
          sourceKind: source.kind,
          sourceExternalId: raw.external_id ?? null,
          sourceReviews: raw.reviews ?? null,
          sourceUrl: raw.source_url ?? null,
          qualityScore: enriched.quality_score,
        });
        itemsEnriched += 1;
      } catch (err: unknown) {
        itemsFailed += 1;
        this.logger.warn(
          `run=${run.id} item "${raw.external_id}" fallo: ${errorMessage(err)}`,
        );
      }
    }

    this.logger.log(
      `run=${run.id} source="${source.name}" done — found=${rawItems.length} ` +
        `enriched=${itemsEnriched} conFoto=${itemsWithImage} failed=${itemsFailed}`,
    );

    await this.runsRepo.finish(run.id, {
      status: itemsFailed > 0 ? 'partial' : 'succeeded',
      itemsFound: rawItems.length,
      itemsEnriched,
      itemsFailed,
    });

    // best-effort: no rompe el run si falla el metadato.
    await this.sourcesRepo.markRun(sourceId);

    this.logger.log(
      `run=${run.id} done — found=${rawItems.length} ` +
        `enriched=${itemsEnriched} failed=${itemsFailed}`,
    );

    return {
      ...run,
      status: itemsFailed > 0 ? 'partial' : 'succeeded',
      items_found: rawItems.length,
      items_enriched: itemsEnriched,
      items_failed: itemsFailed,
      finished_at: new Date().toISOString(),
    };
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
