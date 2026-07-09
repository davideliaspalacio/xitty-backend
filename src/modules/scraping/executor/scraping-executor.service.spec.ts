import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ScrapingExecutorService } from './scraping-executor.service';
import type { EnrichmentResult } from '../enrichment/enrichment.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import type { RawItem, ScraperSource } from '../scraper-source.interface';
import { ScraperSourceFactory } from '../sources/source.factory';
import type {
  InsertEnrichedInput,
  InsertRawInput,
  ScrapedItemEnriched,
  ScrapedItemRaw,
} from '../storage/scraped-items.repo';
import { ScrapedItemsRepo } from '../storage/scraped-items.repo';
import type { ScrapingRun } from '../storage/scraping-runs.repo';
import { ScrapingRunsRepo } from '../storage/scraping-runs.repo';
import type { ScrapingSource } from '../storage/scraping-sources.repo';
import { ScrapingSourcesRepo } from '../storage/scraping-sources.repo';
import type { PhotoStorageService } from '../storage/photo-storage.service';

type SourcesRepoMock = {
  findById: jest.MockedFunction<ScrapingSourcesRepo['findById']>;
  markRun: jest.MockedFunction<ScrapingSourcesRepo['markRun']>;
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

type FactoryMock = {
  build: jest.MockedFunction<ScraperSourceFactory['build']>;
};

type PhotosMock = {
  rehost: jest.MockedFunction<PhotoStorageService['rehost']>;
};

describe('ScrapingExecutorService', () => {
  let service: ScrapingExecutorService;
  let sourcesRepo: SourcesRepoMock;
  let runsRepo: RunsRepoMock;
  let itemsRepo: ItemsRepoMock;
  let enrichment: EnrichmentMock;
  let factory: FactoryMock;
  let photos: PhotosMock;

  beforeEach(() => {
    sourcesRepo = {
      findById: jest.fn<ScrapingSourcesRepo['findById']>(),
      markRun: jest.fn<ScrapingSourcesRepo['markRun']>(),
    };
    runsRepo = {
      start: jest.fn<ScrapingRunsRepo['start']>(),
      finish: jest.fn<ScrapingRunsRepo['finish']>(),
      error: jest.fn<ScrapingRunsRepo['error']>(),
    };
    itemsRepo = {
      insertRaw: jest.fn<ScrapedItemsRepo['insertRaw']>(),
      insertEnriched: jest.fn<ScrapedItemsRepo['insertEnriched']>(),
    };
    enrichment = {
      enrich: jest.fn<EnrichmentService['enrich']>(),
    };
    factory = {
      build: jest.fn<ScraperSourceFactory['build']>(),
    };
    photos = {
      rehost: jest.fn<PhotoStorageService['rehost']>().mockResolvedValue(null),
    };

    service = new ScrapingExecutorService(
      sourcesRepo as unknown as ScrapingSourcesRepo,
      runsRepo as unknown as ScrapingRunsRepo,
      itemsRepo as unknown as ScrapedItemsRepo,
      enrichment as unknown as EnrichmentService,
      factory as unknown as ScraperSourceFactory,
      photos as unknown as PhotoStorageService,
    );
  });

  it('corre el pipeline completo y devuelve el run con metricas', async () => {
    sourcesRepo.findById.mockResolvedValue(scrapingSource());
    factory.build.mockReturnValue(makeFetcher([rawItem('a'), rawItem('b')]));
    runsRepo.start.mockResolvedValue(scrapingRun());
    itemsRepo.insertRaw.mockImplementation((input) =>
      Promise.resolve(rawRow(input)),
    );
    enrichment.enrich.mockResolvedValue(enrichmentResult());
    itemsRepo.insertEnriched.mockResolvedValue(enrichedRow());

    const result = await service.runSource('s1', 'admin');

    expect(runsRepo.start.mock.calls[0]).toEqual(['s1', 'admin']);
    expect(itemsRepo.insertEnriched).toHaveBeenCalledTimes(2);
    expect(runsRepo.finish.mock.calls[0]).toEqual([
      'run-1',
      {
        status: 'succeeded',
        itemsFound: 2,
        itemsEnriched: 2,
        itemsFailed: 0,
      },
    ]);
    expect(sourcesRepo.markRun.mock.calls[0]).toEqual(['s1']);
    expect(result.items_found).toBe(2);
    expect(result.items_enriched).toBe(2);
    expect(result.status).toBe('succeeded');
  });

  it('re-hospeda la foto de la fuente y persiste imageUrl + rating/reseñas + señales a la IA', async () => {
    sourcesRepo.findById.mockResolvedValue(scrapingSource());
    const withPhoto: RawItem = {
      ...rawItem('a'),
      image_url: 'https://src.example/photo.jpg',
      rating: 4.6,
      review_count: 320,
    };
    factory.build.mockReturnValue(makeFetcher([withPhoto]));
    runsRepo.start.mockResolvedValue(scrapingRun());
    itemsRepo.insertRaw.mockResolvedValue(rawRowForExternalId('a'));
    enrichment.enrich.mockResolvedValue(enrichmentResult());
    photos.rehost.mockResolvedValue('https://cdn.example/scraped-photos/a.jpg');
    itemsRepo.insertEnriched.mockResolvedValue(enrichedRow());

    await service.runSource('s1', 'admin');

    expect(photos.rehost.mock.calls[0]).toEqual([
      'https://src.example/photo.jpg',
      'eventbrite/a',
    ]);
    expect(enrichment.enrich.mock.calls[0]).toEqual([
      expect.anything(),
      'eventbrite',
      expect.objectContaining({
        hasImage: true,
        rating: 4.6,
        reviewCount: 320,
      }),
    ]);
    expect(itemsRepo.insertEnriched.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        imageUrl: 'https://cdn.example/scraped-photos/a.jpg',
        rating: 4.6,
        reviewCount: 320,
      }),
    );
  });

  it('copia city/zone desde la config de la source al enriched item', async () => {
    sourcesRepo.findById.mockResolvedValue(
      scrapingSource({ config: { city: 'Cartagena', zone: 'Getsemaní' } }),
    );
    factory.build.mockReturnValue(makeFetcher([rawItem('a')]));
    runsRepo.start.mockResolvedValue(scrapingRun());
    itemsRepo.insertRaw.mockResolvedValue(rawRowForExternalId('a'));
    enrichment.enrich.mockResolvedValue(enrichmentResult());
    itemsRepo.insertEnriched.mockResolvedValue(enrichedRow());

    await service.runSource('s1', 'admin');

    expect(itemsRepo.insertEnriched.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        city: 'Cartagena',
        zone: 'Getsemaní',
      }),
    );
  });

  it('tira NotFound y NO arranca run si la source no existe', async () => {
    sourcesRepo.findById.mockRejectedValue(new NotFoundException('nope'));

    await expect(service.runSource('missing', 'admin')).rejects.toThrow(
      NotFoundException,
    );
    expect(runsRepo.start).not.toHaveBeenCalled();
  });

  it('tira BadRequest si la source esta deshabilitada', async () => {
    sourcesRepo.findById.mockResolvedValue(scrapingSource({ enabled: false }));

    await expect(service.runSource('s1', 'admin')).rejects.toThrow(
      BadRequestException,
    );
    expect(runsRepo.start).not.toHaveBeenCalled();
  });

  it('marca el run como failed y tira si fetch() falla', async () => {
    sourcesRepo.findById.mockResolvedValue(scrapingSource());
    const fetcher = makeFetcher([]);
    fetcher.fetch = jest
      .fn<ScraperSource['fetch']>()
      .mockRejectedValue(new Error('API down'));
    factory.build.mockReturnValue(fetcher);
    runsRepo.start.mockResolvedValue(scrapingRun());

    await expect(service.runSource('s1', 'admin')).rejects.toThrow(
      BadRequestException,
    );
    expect(runsRepo.error.mock.calls[0]).toEqual([
      'run-1',
      expect.stringContaining('fetch()'),
    ]);
    expect(runsRepo.finish).not.toHaveBeenCalled();
  });

  it('saltea items deduplicados a nivel raw (insertRaw=null) sin contarlos como failed', async () => {
    sourcesRepo.findById.mockResolvedValue(scrapingSource());
    factory.build.mockReturnValue(makeFetcher([rawItem('a'), rawItem('b')]));
    runsRepo.start.mockResolvedValue(scrapingRun());
    itemsRepo.insertRaw
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(rawRowForExternalId('b'));
    enrichment.enrich.mockResolvedValue(enrichmentResult({ quality_score: 1 }));
    itemsRepo.insertEnriched.mockResolvedValue(enrichedRow());

    const result = await service.runSource('s1', 'admin');

    expect(itemsRepo.insertEnriched).toHaveBeenCalledTimes(1);
    expect(result.items_found).toBe(2);
    expect(result.items_enriched).toBe(1);
    expect(result.items_failed).toBe(0);
    expect(result.status).toBe('succeeded');
  });

  it('cuenta items_failed y termina partial si un item falla', async () => {
    sourcesRepo.findById.mockResolvedValue(scrapingSource());
    factory.build.mockReturnValue(makeFetcher([rawItem('a'), rawItem('b')]));
    runsRepo.start.mockResolvedValue(scrapingRun());
    itemsRepo.insertRaw.mockResolvedValue(rawRowForExternalId('raw'));
    enrichment.enrich
      .mockResolvedValueOnce(
        enrichmentResult({ title: 'ok', quality_score: 1 }),
      )
      .mockRejectedValueOnce(new Error('enrich boom'));
    itemsRepo.insertEnriched.mockResolvedValue(enrichedRow());

    const result = await service.runSource('s1', 'admin');

    expect(result.items_enriched).toBe(1);
    expect(result.items_failed).toBe(1);
    expect(result.status).toBe('partial');
    expect(runsRepo.finish.mock.calls[0]).toEqual([
      'run-1',
      {
        status: 'partial',
        itemsFound: 2,
        itemsEnriched: 1,
        itemsFailed: 1,
      },
    ]);
  });
});

function scrapingSource(
  overrides: Partial<ScrapingSource> = {},
): ScrapingSource {
  return {
    id: 's1',
    name: 'Eventbrite BAQ',
    kind: 'eventbrite',
    config: {},
    enabled: true,
    schedule_cron: null,
    last_run_at: null,
    created_at: 't',
    updated_at: 't',
    ...overrides,
  };
}

function scrapingRun(overrides: Partial<ScrapingRun> = {}): ScrapingRun {
  return {
    id: 'run-1',
    source_id: 's1',
    status: 'running',
    triggered_by: 'admin',
    items_found: 0,
    items_enriched: 0,
    items_failed: 0,
    error: null,
    started_at: 't',
    finished_at: null,
    ...overrides,
  };
}

function makeFetcher(items: RawItem[]): ScraperSource {
  return {
    id: 'eventbrite',
    name: 'Eventbrite',
    enabled: true,
    fetch: jest.fn<ScraperSource['fetch']>().mockResolvedValue(items),
  };
}

function rawItem(externalId: string): RawItem {
  return {
    external_id: externalId,
    name: `Item ${externalId}`,
    source_url: `https://e.com/${externalId}`,
  };
}

function rawRow(input: InsertRawInput): ScrapedItemRaw {
  return rawRowForExternalId(input.sourceExternalId ?? 'missing', {
    run_id: input.runId,
    source_id: input.sourceId,
    source_url: input.sourceUrl,
    source_external_id: input.sourceExternalId ?? null,
    raw_payload: input.payload,
  });
}

function rawRowForExternalId(
  externalId: string,
  overrides: Partial<ScrapedItemRaw> = {},
): ScrapedItemRaw {
  return {
    id: `raw-${externalId}`,
    run_id: 'run-1',
    source_id: 's1',
    source_url: `https://e.com/${externalId}`,
    source_external_id: externalId,
    raw_payload: {},
    dedup_hash: `hash-${externalId}`,
    scraped_at: 't',
    ...overrides,
  };
}

function enrichmentResult(
  overrides: Partial<EnrichmentResult> = {},
): EnrichmentResult {
  return {
    title: 'X',
    description: null,
    category_hint: null,
    location_name: null,
    lat: null,
    lng: null,
    starts_at: null,
    ends_at: null,
    price_cop: null,
    quality_score: 0.9,
    source_kind: 'eventbrite',
    raw_hash: 'hash',
    is_duplicate: false,
    duplicate_of: null,
    ...overrides,
  };
}

function enrichedRow(
  overrides: Partial<ScrapedItemEnriched> = {},
): ScrapedItemEnriched {
  const input: InsertEnrichedInput = {
    rawId: 'raw-a',
    title: 'X',
  };

  return {
    id: 'enriched-a',
    raw_id: input.rawId,
    title: input.title,
    description: null,
    category_hint: null,
    location_name: null,
    lat: null,
    lng: null,
    starts_at: null,
    ends_at: null,
    price_cop: null,
    image_url: null,
    rating: null,
    review_count: null,
    phone: null,
    website: null,
    opening_hours: null,
    price_level: null,
    city: null,
    zone: null,
    source_kind: null,
    source_external_id: null,
    source_reviews: null,
    source_url: null,
    quality_score: null,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    published_place_id: null,
    published_experience_id: null,
    created_at: 't',
    updated_at: 't',
    ...overrides,
  };
}
