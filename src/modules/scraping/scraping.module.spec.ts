import { Test } from '@nestjs/testing';

import { ScrapingModule } from './scraping.module';
import { ScrapingStorageModule } from './storage/storage.module';
import { EnrichmentModule } from './enrichment/enrichment.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AdminScrapingModule } from './admin/admin-scraping.module';
import { DiscoverModule } from './public/discover.module';

import { ScrapedItemsRepo } from './storage/scraped-items.repo';
import { ScrapingRunsRepo } from './storage/scraping-runs.repo';
import { ScrapingSourcesRepo } from './storage/scraping-sources.repo';
import { EnrichmentService } from './enrichment/enrichment.service';
import { QualityScorerService } from './enrichment/quality-scorer.service';
import { DedupService } from './enrichment/dedup.service';
import { RunnerService } from './scheduler/runner.service';
import { AdminScrapingService } from './admin/admin-scraping.service';
import { DiscoverService } from './public/discover.service';

/**
 * Smoke tests del umbrella ScrapingModule.
 *
 * Verifica que:
 *  1. El module compila y se puede instanciar sin tirar.
 *  2. Reexporta los submodulos (storage, enrichment, scheduler, admin, public)
 *     para que `ScrapingModule` sea el unico import necesario en AppModule.
 *  3. Los providers principales de cada submodulo quedan accesibles via DI
 *     dentro del contexto del umbrella module (sanity check del re-export).
 */
describe('ScrapingModule (umbrella)', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  it('se instancia sin errores', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScrapingModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });

  it('reexporta los submodulos (storage, enrichment, scheduler, admin, public)', () => {
    const meta = Reflect.getMetadata('imports', ScrapingModule) as unknown[];
    expect(meta).toBeDefined();
    expect(meta).toEqual(
      expect.arrayContaining([
        ScrapingStorageModule,
        EnrichmentModule,
        SchedulerModule,
        AdminScrapingModule,
        DiscoverModule,
      ]),
    );

    const exports = Reflect.getMetadata('exports', ScrapingModule) as unknown[];
    expect(exports).toEqual(
      expect.arrayContaining([
        ScrapingStorageModule,
        EnrichmentModule,
        SchedulerModule,
        AdminScrapingModule,
        DiscoverModule,
      ]),
    );
  });

  it('resuelve los providers principales de cada submodulo', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScrapingModule],
    }).compile();

    expect(moduleRef.get(ScrapedItemsRepo, { strict: false })).toBeDefined();
    expect(moduleRef.get(ScrapingRunsRepo, { strict: false })).toBeDefined();
    expect(moduleRef.get(ScrapingSourcesRepo, { strict: false })).toBeDefined();
    expect(moduleRef.get(EnrichmentService, { strict: false })).toBeDefined();
    expect(moduleRef.get(QualityScorerService, { strict: false })).toBeDefined();
    expect(moduleRef.get(DedupService, { strict: false })).toBeDefined();
    expect(moduleRef.get(RunnerService, { strict: false })).toBeDefined();
    expect(moduleRef.get(AdminScrapingService, { strict: false })).toBeDefined();
    expect(moduleRef.get(DiscoverService, { strict: false })).toBeDefined();

    await moduleRef.close();
  });

  it('NO declara providers o controllers propios — solo agrupa submodulos', () => {
    const providers = Reflect.getMetadata('providers', ScrapingModule) as unknown[] | undefined;
    const controllers = Reflect.getMetadata('controllers', ScrapingModule) as unknown[] | undefined;
    expect(providers ?? []).toEqual([]);
    expect(controllers ?? []).toEqual([]);
  });
});
