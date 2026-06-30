import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../../config/database.module';
import { ScrapingStorageModule } from '../storage/storage.module';
import { ExecutorModule } from '../executor/executor.module';
import { AdminScrapingController } from './admin-scraping.controller';
import { AdminScrapingService } from './admin-scraping.service';

/**
 * Panel de moderacion admin del pipeline de scraping.
 *
 * Reusa los repos de ScrapingStorageModule y el ScrapingExecutorService del
 * ExecutorModule (que corre el pipeline real contra la DB) — este module solo
 * agrega el controller + service de orquestacion. El AuthGuard se importa
 * indirectamente via `common/guards/auth.guard.ts` (no necesita registro).
 *
 * Para activar el panel, se debe importar este module en AppModule.
 */
@Module({
  imports: [DatabaseModule, ScrapingStorageModule, ExecutorModule],
  controllers: [AdminScrapingController],
  providers: [AdminScrapingService],
  exports: [AdminScrapingService],
})
export class AdminScrapingModule {}
