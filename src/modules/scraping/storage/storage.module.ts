import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../../config/database.module';
import { ScrapedItemsRepo } from './scraped-items.repo';
import { ScrapingRunsRepo } from './scraping-runs.repo';
import { ScrapingSourcesRepo } from './scraping-sources.repo';
import { PhotoStorageService } from './photo-storage.service';

/**
 * Capa de persistencia del pipeline de scraping.
 *
 * Aisla el acceso a Supabase del resto del modulo (orchestrator, sources,
 * enricher) para que esos componentes puedan testearse sin tocar DB.
 *
 * Exporta los tres repos para que otros submodulos (cron, admin, public feed)
 * los inyecten.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    ScrapingSourcesRepo,
    ScrapingRunsRepo,
    ScrapedItemsRepo,
    PhotoStorageService,
  ],
  exports: [
    ScrapingSourcesRepo,
    ScrapingRunsRepo,
    ScrapedItemsRepo,
    PhotoStorageService,
  ],
})
export class ScrapingStorageModule {}
