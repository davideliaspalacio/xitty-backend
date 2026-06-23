import { Module, Provider } from '@nestjs/common';

import { DatabaseModule } from '../../../config/database.module';
import { EnrichmentService } from './enrichment.service';
import { QualityScorerService } from './quality-scorer.service';
import { DedupService } from './dedup.service';
import { ENRICHMENT_PROVIDER } from './providers/enrichment-provider.interface';
import { GeminiEnrichmentProvider } from './providers/gemini-enrichment-provider';
import { MockEnrichmentProvider } from './providers/mock-enrichment-provider';

/**
 * Seleccion del provider del LLM de enrichment:
 *  - NODE_ENV === 'test'             → MockEnrichmentProvider (siempre)
 *  - GEMINI_API_KEY definida en env  → GeminiEnrichmentProvider
 *  - Sino                             → MockEnrichmentProvider
 *    (la API key es opcional para que el modulo arranque local sin fallar)
 */
function selectEnrichmentProvider(): Provider {
  const isTest = process.env.NODE_ENV === 'test';
  const hasKey = !!process.env.GEMINI_API_KEY;

  if (!isTest && hasKey) {
    return { provide: ENRICHMENT_PROVIDER, useClass: GeminiEnrichmentProvider };
  }
  return { provide: ENRICHMENT_PROVIDER, useClass: MockEnrichmentProvider };
}

@Module({
  imports: [DatabaseModule],
  providers: [
    EnrichmentService,
    QualityScorerService,
    DedupService,
    selectEnrichmentProvider(),
  ],
  exports: [EnrichmentService, QualityScorerService, DedupService],
})
export class EnrichmentModule {}
