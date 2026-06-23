import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../../config/database.module';
import { DiscoverController } from './discover.controller';
import { DiscoverService } from './discover.service';

/**
 * DiscoverModule — feed PUBLICO (sin auth) de items curados que vienen del
 * pipeline de scraping y pasaron moderacion (status='published').
 *
 * Submodulo de `scraping/`. Se registra en `AppModule`.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [DiscoverController],
  providers: [DiscoverService],
  exports: [DiscoverService],
})
export class DiscoverModule {}
