import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../../config/database.module';
import { ScrapingStorageModule } from '../storage/storage.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { AdminScrapingController } from './admin-scraping.controller';
import { AdminScrapingService } from './admin-scraping.service';

/**
 * Panel de moderacion admin del pipeline de scraping.
 *
 * Reusa los repos de ScrapingStorageModule y el RunnerService del
 * SchedulerModule — este module solo agrega el controller + service
 * de orquestacion. El AuthGuard se importa indirectamente via
 * `common/guards/auth.guard.ts` (no necesita registro).
 *
 * Para activar el panel, se debe importar este module en AppModule.
 */
@Module({
  imports: [DatabaseModule, ScrapingStorageModule, SchedulerModule],
  controllers: [AdminScrapingController],
  providers: [AdminScrapingService],
  exports: [AdminScrapingService],
})
export class AdminScrapingModule {}
