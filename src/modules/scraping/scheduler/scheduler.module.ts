import { Module, Provider } from '@nestjs/common';

import { DatabaseModule } from '../../../config/database.module';
import {
  ENRICHMENT_SERVICE,
  EnrichmentService,
  QUALITY_SERVICE,
  QualityService,
  RawItem,
  EnrichedItem,
  SCRAPER_SOURCES,
  ScraperSource,
} from '../scraper-source.interface';
import { RunnerService } from './runner.service';

/**
 * NOOP enrichment — copia el RawItem tal cual a EnrichedItem rellenando
 * los campos requeridos con defaults vacios. Sirve solo hasta que se
 * implementen sources reales y un EnrichmentService propio.
 *
 * Cuando se agregue el modulo de enrichment real, este provider se
 * reemplaza en el SchedulerModule.
 */
class NoopEnrichmentService implements EnrichmentService {
  async enrich(item: RawItem): Promise<EnrichedItem | null> {
    if (!item.name || item.name.trim().length === 0) return null;
    return {
      ...item,
      description: item.description ?? '',
      category: item.category ?? 'general',
      latitude: item.latitude ?? 0,
      longitude: item.longitude ?? 0,
      quality_score: 1,
    };
  }
}

/**
 * NOOP quality — todo pasa con score 1. Reemplazar por una implementacion
 * real cuando se agregue el modulo quality.
 */
class NoopQualityService implements QualityService {
  async score(item: EnrichedItem) {
    return { score: item.quality_score ?? 1, reason: 'noop', passes: true };
  }
}

/**
 * SchedulerModule
 * ───────────────
 * Hoy registra: RunnerService + sources vacias + servicios NOOP.
 *
 * Cuando se agreguen sources concretas (TripAdvisorSource, GooglePlacesSource,
 * EventosBarranquillaSource, ...) se inyectan aca via `useFactory` o
 * `useValue` en el provider de `SCRAPER_SOURCES`.
 *
 * El array `SCRAPER_SOURCES` es la unica fuente de verdad sobre que sources
 * existen — el runner las descubre por inyeccion.
 */
const sourcesProvider: Provider = {
  provide: SCRAPER_SOURCES,
  useValue: [] as ScraperSource[],
};

const enrichmentProvider: Provider = {
  provide: ENRICHMENT_SERVICE,
  useClass: NoopEnrichmentService,
};

const qualityProvider: Provider = {
  provide: QUALITY_SERVICE,
  useClass: NoopQualityService,
};

@Module({
  imports: [DatabaseModule],
  providers: [
    RunnerService,
    sourcesProvider,
    enrichmentProvider,
    qualityProvider,
  ],
  exports: [RunnerService],
})
export class SchedulerModule {}
