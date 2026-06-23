import { Module } from '@nestjs/common';

import { ScrapingStorageModule } from './storage/storage.module';
import { EnrichmentModule } from './enrichment/enrichment.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AdminScrapingModule } from './admin/admin-scraping.module';
import { DiscoverModule } from './public/discover.module';

/**
 * ScrapingModule (umbrella)
 * ─────────────────────────
 * Modulo paraguas que agrupa todos los submodulos del pipeline de scraping
 * para que `AppModule` solo necesite importar UN module en vez de cinco.
 *
 * Submodulos:
 *   - `ScrapingStorageModule` — repos Supabase (sources, runs, items).
 *   - `EnrichmentModule`       — provider LLM + quality scorer + dedup.
 *   - `SchedulerModule`        — RunnerService + registro de `SCRAPER_SOURCES`.
 *                                Las sources concretas (GooglePlaces, Eventbrite,
 *                                Tavily, etc.) viven como providers DENTRO de este
 *                                submodulo — son pluggables via `SCRAPER_SOURCES`,
 *                                no tienen un module propio.
 *   - `AdminScrapingModule`    — panel /admin/scraping/* (Bearer + role admin).
 *   - `DiscoverModule`         — feed publico /discover de items publicados.
 *
 * Reexportamos los submodulos (no providers individuales) — quien importe
 * `ScrapingModule` recibe la API publica completa del pipeline.
 *
 * IMPORTANTE: este module no agrega providers ni controllers propios. Solo
 * agrupa. Si en el futuro se agrega lógica transversal (e.g. un event bus
 * compartido entre runner y admin), va en su propio submodulo.
 */
@Module({
  imports: [
    ScrapingStorageModule,
    EnrichmentModule,
    SchedulerModule,
    AdminScrapingModule,
    DiscoverModule,
  ],
  exports: [
    ScrapingStorageModule,
    EnrichmentModule,
    SchedulerModule,
    AdminScrapingModule,
    DiscoverModule,
  ],
})
export class ScrapingModule {}
