import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { RunnerService } from './runner.service';
import type {
  InsertEnrichedInput,
  InsertRawInput,
  ScrapedItemEnriched,
  ScrapedItemRaw,
} from '../storage/scraped-items.repo';
import { ScrapedItemsRepo } from '../storage/scraped-items.repo';
import type { ScrapingRun as ScrapingRunRow } from '../storage/scraping-runs.repo';
import { ScrapingRunsRepo } from '../storage/scraping-runs.repo';
import {
  ENRICHMENT_SERVICE,
  QUALITY_SERVICE,
  SCRAPER_SOURCES,
} from '../scraper-source.interface';
import type {
  EnrichedItem,
  EnrichmentService,
  QualityService,
  RawItem,
  ScraperSource,
} from '../scraper-source.interface';

type SourceMock = Omit<ScraperSource, 'fetch'> & {
  fetch: jest.MockedFunction<ScraperSource['fetch']>;
};

type RunsRepoMock = {
  start: jest.MockedFunction<ScrapingRunsRepo['start']>;
  finish: jest.MockedFunction<ScrapingRunsRepo['finish']>;
  error: jest.MockedFunction<ScrapingRunsRepo['error']>;
};

type ItemsRepoMock = {
  insertRaw: jest.MockedFunction<ScrapedItemsRepo['insertRaw']>;
  insertEnriched: jest.MockedFunction<ScrapedItemsRepo['insertEnriched']>;
};

type EnrichmentMock = {
  enrich: jest.MockedFunction<EnrichmentService['enrich']>;
};

type QualityMock = {
  score: jest.MockedFunction<QualityService['score']>;
};

describe('RunnerService', () => {
  let runner: RunnerService;
  let runsRepo: RunsRepoMock;
  let itemsRepo: ItemsRepoMock;
  let enrichment: EnrichmentMock;
  let quality: QualityMock;

  let rawSeq = 0;

  async function build(srcs: ScraperSource[]): Promise<void> {
    rawSeq = 0;

    runsRepo = {
      start: jest
        .fn<ScrapingRunsRepo['start']>()
        .mockResolvedValue(scrapingRunRow({ id: 'run-1' })),
      finish: jest
        .fn<ScrapingRunsRepo['finish']>()
        .mockResolvedValue(undefined),
      error: jest.fn<ScrapingRunsRepo['error']>().mockResolvedValue(undefined),
    };

    itemsRepo = {
      insertRaw: jest
        .fn<ScrapedItemsRepo['insertRaw']>()
        .mockImplementation((input: InsertRawInput) =>
          Promise.resolve(rawRow(input, { id: `raw-${++rawSeq}` })),
        ),
      insertEnriched: jest
        .fn<ScrapedItemsRepo['insertEnriched']>()
        .mockImplementation((input: InsertEnrichedInput) =>
          Promise.resolve(enrichedRow(input)),
        ),
    };

    enrichment = {
      enrich: jest
        .fn<EnrichmentService['enrich']>()
        .mockImplementation((item: RawItem) =>
          Promise.resolve(enrichedFrom(item)),
        ),
    };
    quality = {
      score: jest
        .fn<QualityService['score']>()
        .mockImplementation((item: EnrichedItem) =>
          Promise.resolve({
            score: item.quality_score,
            reason: 'ok',
            passes: item.quality_score >= 0.5,
          }),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunnerService,
        { provide: ScrapingRunsRepo, useValue: runsRepo },
        { provide: ScrapedItemsRepo, useValue: itemsRepo },
        { provide: SCRAPER_SOURCES, useValue: srcs },
        { provide: ENRICHMENT_SERVICE, useValue: enrichment },
        { provide: QUALITY_SERVICE, useValue: quality },
      ],
    }).compile();

    runner = module.get(RunnerService);
  }

  describe('runSource — happy path', () => {
    it('orquesta start → fetch → insertRaw → enrich → insertEnriched → finish', async () => {
      const src = mockSource({
        id: 'tripadvisor',
        fetch: jest
          .fn<ScraperSource['fetch']>()
          .mockResolvedValue([
            rawItem({ external_id: 'a', name: 'Lugar A' }),
            rawItem({ external_id: 'b', name: 'Lugar B' }),
          ]),
      });
      await build([src]);

      const run = await runner.runSource('tripadvisor', 'admin-42');

      expect(runsRepo.start).toHaveBeenCalledTimes(1);
      expect(runsRepo.start.mock.calls[0]).toEqual(['tripadvisor', 'admin-42']);
      expect(src.fetch).toHaveBeenCalledTimes(1);
      expect(itemsRepo.insertRaw).toHaveBeenCalledTimes(2);
      expect(enrichment.enrich).toHaveBeenCalledTimes(2);
      expect(quality.score).toHaveBeenCalledTimes(2);
      expect(itemsRepo.insertEnriched).toHaveBeenCalledTimes(2);
      expect(runsRepo.finish).toHaveBeenCalledTimes(1);
      expect(runsRepo.finish.mock.calls[0]).toEqual([
        'run-1',
        {
          status: 'succeeded',
          itemsFound: 2,
          itemsEnriched: 2,
          itemsFailed: 0,
        },
      ]);
      expect(run.source_id).toBe('tripadvisor');
      expect(run.items_found).toBe(2);
      expect(run.items_enriched).toBe(2);
      expect(run.items_persisted).toBe(2);
      expect(run.items_failed).toBe(0);
      expect(run.errored).toBe(false);
      expect(run.duration_ms).toBeGreaterThanOrEqual(0);
      expect(typeof run.started_at).toBe('string');
      expect(typeof run.finished_at).toBe('string');
    });

    it('insertRaw recibe run_id, source_id, source_url y payload', async () => {
      const src = mockSource({
        id: 'src-x',
        fetch: jest
          .fn<ScraperSource['fetch']>()
          .mockResolvedValue([
            rawItem({ external_id: 'a', source_url: 'https://x.co/a' }),
          ]),
      });
      await build([src]);

      await runner.runSource('src-x', 'cron');

      const arg = itemsRepo.insertRaw.mock.calls[0]?.[0];
      expect(arg?.runId).toBe('run-1');
      expect(arg?.sourceId).toBe('src-x');
      expect(arg?.sourceUrl).toBe('https://x.co/a');
      expect(arg?.sourceExternalId).toBe('a');
      expect(arg?.payload).toBeDefined();
    });

    it('insertEnriched mapea los campos normalizados y queda pending', async () => {
      const src = mockSource({
        id: 'src-e',
        fetch: jest.fn<ScraperSource['fetch']>().mockResolvedValue([
          rawItem({
            external_id: 'a',
            name: 'Café del Mar',
            description: 'lindo',
            category: 'cafe',
            address: 'Malecón',
            latitude: 11.01,
            longitude: -74.8,
            source_url: 'https://x.co/a',
          }),
        ]),
      });
      await build([src]);

      await runner.runSource('src-e', 'cron');

      const arg = itemsRepo.insertEnriched.mock.calls[0]?.[0];
      expect(arg?.rawId).toBe('raw-1');
      expect(arg?.title).toBe('Café del Mar');
      expect(arg?.description).toBe('lindo');
      expect(arg?.categoryHint).toBe('cafe');
      expect(arg?.locationName).toBe('Malecón');
      expect(arg?.lat).toBe(11.01);
      expect(arg?.lng).toBe(-74.8);
      expect(arg?.sourceUrl).toBe('https://x.co/a');
      expect(arg?.qualityScore).toBe(0.9);

      const resultValue = itemsRepo.insertEnriched.mock.results[0]?.value as
        | Promise<ScrapedItemEnriched>
        | undefined;
      const result = await resultValue;
      expect(result?.status).toBe('pending');
    });

    it('triggered_by por defecto es "manual" si no se pasa', async () => {
      const src = mockSource({ id: 'src-d' });
      await build([src]);

      await runner.runSource('src-d');

      expect(runsRepo.start.mock.calls[0]).toEqual(['src-d', 'manual']);
    });

    it('tira NotFoundException si el sourceId no existe', async () => {
      await build([mockSource({ id: 'a' })]);

      await expect(runner.runSource('does-not-exist')).rejects.toThrow(
        NotFoundException,
      );
      expect(runsRepo.start).not.toHaveBeenCalled();
    });

    it('no corre una source con enabled=false aunque se la pidan por id', async () => {
      const src = mockSource({ id: 'disabled-src', enabled: false });
      await build([src]);

      await expect(runner.runSource('disabled-src')).rejects.toThrow();
      expect(src.fetch).not.toHaveBeenCalled();
      expect(runsRepo.start).not.toHaveBeenCalled();
    });
  });

  describe('runSource — dedup', () => {
    it('items deduplicados (insertRaw devuelve null) no se enriquecen ni persisten', async () => {
      const src = mockSource({
        id: 'dedup',
        fetch: jest
          .fn<ScraperSource['fetch']>()
          .mockResolvedValue([
            rawItem({ external_id: 'nuevo', source_url: 'https://x.co/nuevo' }),
            rawItem({ external_id: 'viejo', source_url: 'https://x.co/viejo' }),
          ]),
      });
      await build([src]);
      itemsRepo.insertRaw.mockImplementation((input) => {
        if (input.sourceExternalId === 'viejo') return Promise.resolve(null);
        return Promise.resolve(rawRow(input, { id: `raw-${++rawSeq}` }));
      });

      const run = await runner.runSource('dedup', 'cron');

      expect(itemsRepo.insertRaw).toHaveBeenCalledTimes(2);
      expect(enrichment.enrich).toHaveBeenCalledTimes(1);
      expect(itemsRepo.insertEnriched).toHaveBeenCalledTimes(1);
      expect(run.items_found).toBe(2);
      expect(run.items_deduped).toBe(1);
      expect(run.items_enriched).toBe(1);
      expect(run.items_persisted).toBe(1);
    });
  });

  describe('runSource — fetch fallido', () => {
    it('captura el error de fetch, marca el run como failed y devuelve errored=true', async () => {
      const src = mockSource({
        id: 'broken',
        fetch: jest
          .fn<ScraperSource['fetch']>()
          .mockRejectedValue(new Error('API down')),
      });
      await build([src]);

      const run = await runner.runSource('broken', 'cron');

      expect(run.errored).toBe(true);
      expect(run.error_message).toContain('API down');
      expect(run.items_found).toBe(0);
      expect(run.items_enriched).toBe(0);
      expect(enrichment.enrich).not.toHaveBeenCalled();
      expect(runsRepo.start).toHaveBeenCalledTimes(1);
      expect(runsRepo.error).toHaveBeenCalledTimes(1);
      expect(runsRepo.error.mock.calls[0]?.[0]).toBe('run-1');
      expect(runsRepo.error.mock.calls[0]?.[1]).toContain('API down');
      expect(runsRepo.finish).not.toHaveBeenCalled();
    });

    it('no propaga el error — siempre devuelve un summary', async () => {
      const src = mockSource({
        id: 'broken-2',
        fetch: jest
          .fn<ScraperSource['fetch']>()
          .mockRejectedValue(new Error('timeout')),
      });
      await build([src]);

      await expect(runner.runSource('broken-2', 'cron')).resolves.toMatchObject(
        {
          source_id: 'broken-2',
          errored: true,
        },
      );
    });
  });

  describe('runSource — conteo de metricas', () => {
    it('cuenta correctamente cuando algunos items fallan en enrichment', async () => {
      const src = mockSource({
        id: 'mixed',
        fetch: jest
          .fn<ScraperSource['fetch']>()
          .mockResolvedValue([
            rawItem({ external_id: '1', source_url: 'https://x.co/1' }),
            rawItem({ external_id: '2', source_url: 'https://x.co/2' }),
            rawItem({ external_id: '3', source_url: 'https://x.co/3' }),
          ]),
      });
      await build([src]);
      enrichment.enrich.mockImplementation((item) => {
        if (item.external_id === '2')
          return Promise.reject(new Error('geocoding failed'));
        if (item.external_id === '3') return Promise.resolve(null);
        return Promise.resolve(enrichedFrom(item));
      });

      const run = await runner.runSource('mixed', 'cron');

      expect(run.items_found).toBe(3);
      expect(run.items_enriched).toBe(1);
      expect(run.items_failed).toBe(2);
      expect(run.errored).toBe(false);
      expect(itemsRepo.insertEnriched).toHaveBeenCalledTimes(1);
      expect(runsRepo.finish.mock.calls[0]).toEqual([
        'run-1',
        {
          status: 'partial',
          itemsFound: 3,
          itemsEnriched: 1,
          itemsFailed: 2,
        },
      ]);
    });

    it('cuenta items_persisted segun quality threshold', async () => {
      const src = mockSource({
        id: 'q',
        fetch: jest
          .fn<ScraperSource['fetch']>()
          .mockResolvedValue([
            rawItem({ external_id: 'hi', source_url: 'https://x.co/hi' }),
            rawItem({ external_id: 'lo', source_url: 'https://x.co/lo' }),
          ]),
      });
      await build([src]);
      enrichment.enrich.mockImplementation((item) =>
        Promise.resolve(
          enrichedFrom(item, item.external_id === 'hi' ? 0.9 : 0.2),
        ),
      );

      const run = await runner.runSource('q', 'cron');

      expect(run.items_enriched).toBe(2);
      expect(run.items_persisted).toBe(1);
      expect(itemsRepo.insertEnriched).toHaveBeenCalledTimes(1);
      expect(quality.score).toHaveBeenCalledTimes(2);
    });

    it('items_found=0 cuando fetch devuelve array vacio (no es error)', async () => {
      const src = mockSource({
        id: 'empty',
        fetch: jest.fn<ScraperSource['fetch']>().mockResolvedValue([]),
      });
      await build([src]);

      const run = await runner.runSource('empty', 'cron');

      expect(run.items_found).toBe(0);
      expect(run.items_enriched).toBe(0);
      expect(run.items_failed).toBe(0);
      expect(run.errored).toBe(false);
      expect(enrichment.enrich).not.toHaveBeenCalled();
      expect(itemsRepo.insertRaw).not.toHaveBeenCalled();
      expect(runsRepo.start).toHaveBeenCalledTimes(1);
      expect(runsRepo.finish.mock.calls[0]).toEqual([
        'run-1',
        {
          status: 'succeeded',
          itemsFound: 0,
          itemsEnriched: 0,
          itemsFailed: 0,
        },
      ]);
    });
  });

  describe('runAll', () => {
    it('itera sobre todas las sources con enabled=true', async () => {
      const a = mockSource({
        id: 'a',
        fetch: jest
          .fn<ScraperSource['fetch']>()
          .mockResolvedValue([
            rawItem({ external_id: 'a1', source_url: 'https://x.co/a1' }),
          ]),
      });
      const b = mockSource({
        id: 'b',
        fetch: jest
          .fn<ScraperSource['fetch']>()
          .mockResolvedValue([
            rawItem({ external_id: 'b1', source_url: 'https://x.co/b1' }),
          ]),
      });
      await build([a, b]);

      const runs = await runner.runAll('cron');

      expect(runs).toHaveLength(2);
      expect(runs.map((r) => r.source_id).sort()).toEqual(['a', 'b']);
      expect(a.fetch).toHaveBeenCalledTimes(1);
      expect(b.fetch).toHaveBeenCalledTimes(1);
      expect(runsRepo.start).toHaveBeenCalledTimes(2);
    });

    it('saltea las sources con enabled=false', async () => {
      const on = mockSource({ id: 'on', enabled: true });
      const off = mockSource({ id: 'off', enabled: false });
      await build([on, off]);

      const runs = await runner.runAll('cron');

      expect(runs).toHaveLength(1);
      expect(runs[0].source_id).toBe('on');
      expect(off.fetch).not.toHaveBeenCalled();
    });

    it('una source que falla NO detiene a las demas', async () => {
      const ok = mockSource({
        id: 'ok',
        fetch: jest.fn<ScraperSource['fetch']>().mockResolvedValue([]),
      });
      const bad = mockSource({
        id: 'bad',
        fetch: jest
          .fn<ScraperSource['fetch']>()
          .mockRejectedValue(new Error('boom')),
      });
      await build([ok, bad]);

      const runs = await runner.runAll('cron');

      expect(runs).toHaveLength(2);
      const badRun = runs.find((r) => r.source_id === 'bad');
      const okRun = runs.find((r) => r.source_id === 'ok');
      expect(badRun?.errored).toBe(true);
      expect(okRun?.errored).toBe(false);
    });

    it('devuelve array vacio si no hay sources registradas', async () => {
      await build([]);

      const runs = await runner.runAll('cron');

      expect(runs).toEqual([]);
      expect(runsRepo.start).not.toHaveBeenCalled();
    });
  });
});

function mockSource(overrides: Partial<SourceMock> = {}): SourceMock {
  return {
    id: 'mock-source',
    name: 'Mock Source',
    enabled: true,
    fetch: jest.fn<ScraperSource['fetch']>().mockResolvedValue([]),
    ...overrides,
  };
}

function rawItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    external_id: 'ext-1',
    name: 'Test Place',
    description: 'Una descripcion',
    category: 'restaurante',
    address: 'Calle 84 #45-21',
    latitude: 10.99,
    longitude: -74.79,
    source_url: 'https://example.com/ext-1',
    ...overrides,
  };
}

function enrichedFrom(item: RawItem, qualityScore = 0.9): EnrichedItem {
  return {
    ...item,
    description: item.description ?? 'enriched description',
    category: item.category ?? 'restaurante',
    latitude: item.latitude ?? 10.99,
    longitude: item.longitude ?? -74.79,
    quality_score: qualityScore,
  };
}

function scrapingRunRow(
  overrides: Partial<ScrapingRunRow> = {},
): ScrapingRunRow {
  return {
    id: 'run-1',
    source_id: 's',
    status: 'running',
    triggered_by: 'manual',
    items_found: 0,
    items_enriched: 0,
    items_failed: 0,
    error: null,
    started_at: 't',
    finished_at: null,
    ...overrides,
  };
}

function rawRow(
  input: InsertRawInput,
  overrides: Partial<ScrapedItemRaw> = {},
): ScrapedItemRaw {
  return {
    id: 'raw-1',
    run_id: input.runId,
    source_id: input.sourceId,
    source_url: input.sourceUrl,
    source_external_id: input.sourceExternalId ?? null,
    raw_payload: input.payload,
    dedup_hash: `hash-${input.sourceExternalId ?? input.sourceUrl}`,
    scraped_at: 't',
    ...overrides,
  };
}

function enrichedRow(input: InsertEnrichedInput): ScrapedItemEnriched {
  return {
    id: `enr-${input.rawId}`,
    raw_id: input.rawId,
    title: input.title,
    description: input.description ?? null,
    category_hint: input.categoryHint ?? null,
    location_name: input.locationName ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    price_cop: input.priceCop ?? null,
    image_url: input.imageUrl ?? null,
    rating: input.rating ?? null,
    review_count: input.reviewCount ?? null,
    phone: input.phone ?? null,
    website: input.website ?? null,
    opening_hours: input.openingHours ?? null,
    price_level: input.priceLevel ?? null,
    city: input.city ?? null,
    zone: input.zone ?? null,
    source_kind: input.sourceKind ?? null,
    source_external_id: input.sourceExternalId ?? null,
    source_reviews: input.sourceReviews ?? null,
    source_url: input.sourceUrl ?? null,
    quality_score: input.qualityScore ?? null,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    published_place_id: null,
    published_experience_id: null,
    created_at: 't',
    updated_at: 't',
  };
}
