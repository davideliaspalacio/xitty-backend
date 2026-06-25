import { Module } from '@nestjs/common';

import { ScrapingStorageModule } from '../storage/storage.module';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { ScraperSourceFactory } from '../sources/source.factory';
import { ScrapingExecutorService } from './scraping-executor.service';

/**
 * ExecutorModule
 * ──────────────
 * Orquestador real del pipeline (manual run desde el admin, y a futuro el cron).
 * Conecta los repos de storage con el EnrichmentService y el factory de sources.
 *
 * Exporta `ScrapingExecutorService` para que el AdminScrapingModule lo inyecte.
 */
@Module({
  imports: [ScrapingStorageModule, EnrichmentModule],
  providers: [ScraperSourceFactory, ScrapingExecutorService],
  exports: [ScrapingExecutorService],
})
export class ExecutorModule {}
