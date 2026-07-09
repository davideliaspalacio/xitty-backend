import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { ScrapingExecutorService } from './scraping-executor.service';
import { ScrapingSourcesRepo } from '../storage/scraping-sources.repo';
import { ScrapingRunsRepo } from '../storage/scraping-runs.repo';
import { ScrapedItemsRepo } from '../storage/scraped-items.repo';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { ScraperSourceFactory } from '../sources/source.factory';
import type { RawItem, ScraperSource } from '../scraper-source.interface';

describe('ScrapingExecutorService', () => {
  let service: ScrapingExecutorService;
  let sourcesRepo: jest.Mocked<ScrapingSourcesRepo>;
  let runsRepo: jest.Mocked<ScrapingRunsRepo>;
  let itemsRepo: jest.Mocked<ScrapedItemsRepo>;
  let enrichment: jest.Mocked<EnrichmentService>;
  let factory: jest.Mocked<ScraperSourceFactory>;
  let photos: { rehost: jest.Mock };

  const ENABLED_SOURCE = {
    id: 's1',
    name: 'Eventbrite BAQ',
    kind: 'eventbrite',
    config: {},
    enabled: true,
    schedule_cron: null,
    last_run_at: null,
    created_at: 't',
    updated_at: 't',
  } as any;

  const RUN_ROW = {
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
  } as any;

  function makeFetcher(items: RawItem[]): ScraperSource {
    return {
      id: 'eventbrite',
      name: 'Eventbrite',
      enabled: true,
      fetch: jest.fn().mockResolvedValue(items),
    };
  }

  function rawItem(externalId: string): RawItem {
    return {
      external_id: externalId,
      name: `Item ${externalId}`,
      source_url: `https://e.com/${externalId}`,
    };
  }

  beforeEach(() => {
    sourcesRepo = { findById: jest.fn(), markRun: jest.fn() } as any;
    runsRepo = { start: jest.fn(), finish: jest.fn(), error: jest.fn() } as any;
    itemsRepo = { insertRaw: jest.fn(), insertEnriched: jest.fn() } as any;
    enrichment = { enrich: jest.fn() } as any;
    factory = { build: jest.fn() } as any;
    photos = { rehost: jest.fn().mockResolvedValue(null) } as any;

    service = new ScrapingExecutorService(
      sourcesRepo,
      runsRepo,
      itemsRepo,
      enrichment,
      factory,
      photos,
    );
  });

  it('corre el pipeline completo y devuelve el run con metricas', async () => {
    sourcesRepo.findById.mockResolvedValue(ENABLED_SOURCE);
    factory.build.mockReturnValue(makeFetcher([rawItem('a'), rawItem('b')]));
    runsRepo.start.mockResolvedValue(RUN_ROW);
    itemsRepo.insertRaw.mockImplementation(
      async (input: any) => ({ id: `raw-${input.sourceExternalId}`, raw_payload: {} } as any),
    );
    enrichment.enrich.mockResolvedValue({
      title: 'X',
      is_duplicate: false,
      quality_score: 0.9,
    } as any);
    itemsRepo.insertEnriched.mockResolvedValue({} as any);

    const result = await service.runSource('s1', 'admin');

    expect(runsRepo.start).toHaveBeenCalledWith('s1', 'admin');
    expect(itemsRepo.insertEnriched).toHaveBeenCalledTimes(2);
    expect(runsRepo.finish).toHaveBeenCalledWith('run-1', {
      status: 'succeeded',
      itemsFound: 2,
      itemsEnriched: 2,
      itemsFailed: 0,
    });
    expect(sourcesRepo.markRun).toHaveBeenCalledWith('s1');
    expect(result.items_found).toBe(2);
    expect(result.items_enriched).toBe(2);
    expect(result.status).toBe('succeeded');
  });

  it('re-hospeda la foto de la fuente y persiste imageUrl + rating/reseñas + señales a la IA', async () => {
    sourcesRepo.findById.mockResolvedValue(ENABLED_SOURCE);
    const withPhoto = {
      ...rawItem('a'),
      image_url: 'https://src.example/photo.jpg',
      rating: 4.6,
      review_count: 320,
    };
    factory.build.mockReturnValue(makeFetcher([withPhoto]));
    runsRepo.start.mockResolvedValue(RUN_ROW);
    itemsRepo.insertRaw.mockResolvedValue({
      id: 'raw-a',
      raw_payload: {},
    } as any);
    enrichment.enrich.mockResolvedValue({
      title: 'X',
      is_duplicate: false,
      quality_score: 0.9,
    } as any);
    photos.rehost.mockResolvedValue('https://cdn.example/scraped-photos/a.jpg');
    itemsRepo.insertEnriched.mockResolvedValue({} as any);

    await service.runSource('s1', 'admin');

    expect(photos.rehost).toHaveBeenCalledWith(
      'https://src.example/photo.jpg',
      'eventbrite/a',
    );
    expect(enrichment.enrich).toHaveBeenCalledWith(
      expect.anything(),
      'eventbrite',
      expect.objectContaining({ hasImage: true, rating: 4.6, reviewCount: 320 }),
    );
    expect(itemsRepo.insertEnriched).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'https://cdn.example/scraped-photos/a.jpg',
        rating: 4.6,
        reviewCount: 320,
      }),
    );
  });

  it('copia city/zone desde la config de la source al enriched item', async () => {
    sourcesRepo.findById.mockResolvedValue({
      ...ENABLED_SOURCE,
      config: { city: 'Cartagena', zone: 'Getsemaní' },
    });
    factory.build.mockReturnValue(makeFetcher([rawItem('a')]));
    runsRepo.start.mockResolvedValue(RUN_ROW);
    itemsRepo.insertRaw.mockResolvedValue({
      id: 'raw-a',
      raw_payload: {},
    } as any);
    enrichment.enrich.mockResolvedValue({
      title: 'X',
      is_duplicate: false,
      quality_score: 0.9,
    } as any);
    itemsRepo.insertEnriched.mockResolvedValue({} as any);

    await service.runSource('s1', 'admin');

    expect(itemsRepo.insertEnriched).toHaveBeenCalledWith(
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
    sourcesRepo.findById.mockResolvedValue({ ...ENABLED_SOURCE, enabled: false });
    await expect(service.runSource('s1', 'admin')).rejects.toThrow(
      BadRequestException,
    );
    expect(runsRepo.start).not.toHaveBeenCalled();
  });

  it('marca el run como failed y tira si fetch() falla', async () => {
    sourcesRepo.findById.mockResolvedValue(ENABLED_SOURCE);
    const fetcher = makeFetcher([]);
    (fetcher.fetch as jest.Mock).mockRejectedValue(new Error('API down'));
    factory.build.mockReturnValue(fetcher);
    runsRepo.start.mockResolvedValue(RUN_ROW);

    await expect(service.runSource('s1', 'admin')).rejects.toThrow(
      BadRequestException,
    );
    expect(runsRepo.error).toHaveBeenCalledWith(
      'run-1',
      expect.stringContaining('fetch()'),
    );
    expect(runsRepo.finish).not.toHaveBeenCalled();
  });

  it('saltea items deduplicados a nivel raw (insertRaw=null) sin contarlos como failed', async () => {
    sourcesRepo.findById.mockResolvedValue(ENABLED_SOURCE);
    factory.build.mockReturnValue(makeFetcher([rawItem('a'), rawItem('b')]));
    runsRepo.start.mockResolvedValue(RUN_ROW);
    // primer item: dedup hit (null); segundo: insertado
    itemsRepo.insertRaw
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce({ id: 'raw-b', raw_payload: {} } as any);
    enrichment.enrich.mockResolvedValue({
      title: 'X',
      is_duplicate: false,
      quality_score: 1,
    } as any);
    itemsRepo.insertEnriched.mockResolvedValue({} as any);

    const result = await service.runSource('s1', 'admin');

    expect(itemsRepo.insertEnriched).toHaveBeenCalledTimes(1);
    expect(result.items_found).toBe(2);
    expect(result.items_enriched).toBe(1);
    expect(result.items_failed).toBe(0);
    expect(result.status).toBe('succeeded');
  });

  it('cuenta items_failed y termina partial si un item falla', async () => {
    sourcesRepo.findById.mockResolvedValue(ENABLED_SOURCE);
    factory.build.mockReturnValue(makeFetcher([rawItem('a'), rawItem('b')]));
    runsRepo.start.mockResolvedValue(RUN_ROW);
    itemsRepo.insertRaw.mockResolvedValue({ id: 'raw', raw_payload: {} } as any);
    enrichment.enrich
      .mockResolvedValueOnce({ title: 'ok', is_duplicate: false, quality_score: 1 } as any)
      .mockRejectedValueOnce(new Error('enrich boom'));
    itemsRepo.insertEnriched.mockResolvedValue({} as any);

    const result = await service.runSource('s1', 'admin');

    expect(result.items_enriched).toBe(1);
    expect(result.items_failed).toBe(1);
    expect(result.status).toBe('partial');
    expect(runsRepo.finish).toHaveBeenCalledWith('run-1', {
      status: 'partial',
      itemsFound: 2,
      itemsEnriched: 1,
      itemsFailed: 1,
    });
  });
});
