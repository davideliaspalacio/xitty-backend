import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AdminScrapingService } from './admin-scraping.service';
import { ScrapingExecutorService } from '../executor/scraping-executor.service';
import type {
  ScrapedItemEnriched,
  UpdateEnrichedFields,
} from '../storage/scraped-items.repo';
import { ScrapedItemsRepo } from '../storage/scraped-items.repo';
import type { ScrapingRun } from '../storage/scraping-runs.repo';
import { ScrapingRunsRepo } from '../storage/scraping-runs.repo';
import type { ScrapingSource } from '../storage/scraping-sources.repo';
import { ScrapingSourcesRepo } from '../storage/scraping-sources.repo';

interface MockDbError {
  message: string;
}

interface MockDbResult {
  data: unknown;
  error: MockDbError | null;
  count?: number | null;
}

type ChainMethod = jest.MockedFunction<(...args: unknown[]) => MockChain>;

interface MockChain extends PromiseLike<MockDbResult> {
  from: ChainMethod;
  select: ChainMethod;
  insert: ChainMethod;
  update: ChainMethod;
  delete: ChainMethod;
  upsert: ChainMethod;
  eq: ChainMethod;
  neq: ChainMethod;
  in: ChainMethod;
  order: ChainMethod;
  range: ChainMethod;
  limit: ChainMethod;
  single: ChainMethod;
  maybeSingle: ChainMethod;
}

interface MockSupabase {
  from: ChainMethod;
  rpc: jest.MockedFunction<(...args: unknown[]) => unknown>;
  _on: (data: unknown, error?: MockDbError, count?: number | null) => MockChain;
}

type SourcesRepoMock = {
  findAll: jest.MockedFunction<ScrapingSourcesRepo['findAll']>;
  findById: jest.MockedFunction<ScrapingSourcesRepo['findById']>;
  upsert: jest.MockedFunction<ScrapingSourcesRepo['upsert']>;
  patch: jest.MockedFunction<ScrapingSourcesRepo['patch']>;
};

type RunsRepoMock = {
  listBySource: jest.MockedFunction<ScrapingRunsRepo['listBySource']>;
};

type ItemsRepoMock = {
  listByStatus: jest.MockedFunction<ScrapedItemsRepo['listByStatus']>;
  findById: jest.MockedFunction<ScrapedItemsRepo['findById']>;
  updateFields: jest.MockedFunction<ScrapedItemsRepo['updateFields']>;
  approve: jest.MockedFunction<ScrapedItemsRepo['approve']>;
  reject: jest.MockedFunction<ScrapedItemsRepo['reject']>;
  publish: jest.MockedFunction<ScrapedItemsRepo['publish']>;
};

type ExecutorMock = {
  runSource: jest.MockedFunction<ScrapingExecutorService['runSource']>;
};

interface PlaceInsertRow {
  name?: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source_kind?: string | null;
  source_external_id?: string | null;
  source_url?: string | null;
  data_provenance?: {
    source?: unknown;
  };
}

interface ExperienceInsertRow {
  title?: string;
  price_cop?: number;
  duration_minutes?: number;
}

function createChain(result: MockDbResult): MockChain {
  const chain = {} as MockChain;
  const methods = [
    'from',
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'in',
    'order',
    'range',
    'limit',
    'single',
    'maybeSingle',
  ] satisfies Array<keyof Omit<MockChain, 'then'>>;

  for (const method of methods) {
    chain[method] = jest
      .fn<(...args: unknown[]) => MockChain>()
      .mockReturnValue(chain);
  }

  const promise = Promise.resolve(result);
  chain.then = <TResult1 = MockDbResult, TResult2 = never>(
    onfulfilled?:
      | ((value: MockDbResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> => promise.then(onfulfilled, onrejected);
  return chain;
}

function createMockSupabase(): MockSupabase {
  const mock: MockSupabase = {
    from: jest.fn<(...args: unknown[]) => MockChain>(),
    rpc: jest.fn<(...args: unknown[]) => unknown>(),
    _on: (data: unknown, error?: MockDbError, count?: number | null) => {
      const c = createChain({ data, error: error ?? null, count });
      mock.from.mockReturnValueOnce(c);
      return c;
    },
  };
  mock.from.mockImplementation(() => createChain({ data: null, error: null }));
  return mock;
}

function firstArg<T>(method: ChainMethod): T {
  return method.mock.calls[0]?.[0] as T;
}

describe('AdminScrapingService', () => {
  let service: AdminScrapingService;
  let supabase: MockSupabase;
  let sourcesRepo: SourcesRepoMock;
  let runsRepo: RunsRepoMock;
  let itemsRepo: ItemsRepoMock;
  let executor: ExecutorMock;

  beforeEach(async () => {
    supabase = createMockSupabase();

    sourcesRepo = {
      findAll: jest.fn<ScrapingSourcesRepo['findAll']>(),
      findById: jest.fn<ScrapingSourcesRepo['findById']>(),
      upsert: jest.fn<ScrapingSourcesRepo['upsert']>(),
      patch: jest.fn<ScrapingSourcesRepo['patch']>(),
    };

    runsRepo = {
      listBySource: jest.fn<ScrapingRunsRepo['listBySource']>(),
    };

    itemsRepo = {
      listByStatus: jest.fn<ScrapedItemsRepo['listByStatus']>(),
      findById: jest.fn<ScrapedItemsRepo['findById']>(),
      updateFields: jest.fn<ScrapedItemsRepo['updateFields']>(),
      approve: jest.fn<ScrapedItemsRepo['approve']>(),
      reject: jest.fn<ScrapedItemsRepo['reject']>(),
      publish: jest.fn<ScrapedItemsRepo['publish']>(),
    };

    executor = {
      runSource: jest.fn<ScrapingExecutorService['runSource']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminScrapingService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
        {
          provide: ScrapingSourcesRepo,
          useValue: sourcesRepo as unknown as ScrapingSourcesRepo,
        },
        {
          provide: ScrapingRunsRepo,
          useValue: runsRepo as unknown as ScrapingRunsRepo,
        },
        {
          provide: ScrapedItemsRepo,
          useValue: itemsRepo as unknown as ScrapedItemsRepo,
        },
        {
          provide: ScrapingExecutorService,
          useValue: executor as unknown as ScrapingExecutorService,
        },
      ],
    }).compile();

    service = module.get(AdminScrapingService);
  });

  describe('listSources', () => {
    it('devuelve lista con last_run_at y items_count agregado', async () => {
      sourcesRepo.findAll.mockResolvedValue([
        scrapingSource({
          id: 's1',
          name: 'foursquare',
          kind: 'google_places',
          last_run_at: '2026-06-20T00:00:00Z',
        }),
        scrapingSource({
          id: 's2',
          name: 'eventbrite',
          enabled: false,
        }),
      ]);
      supabase._on(null, undefined, 12);
      supabase._on(null, undefined, 0);

      const result = await service.listSources();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('s1');
      expect(result[0].last_run_at).toBe('2026-06-20T00:00:00Z');
      expect(typeof result[0].items_count).toBe('number');
      expect(sourcesRepo.findAll).toHaveBeenCalled();
    });

    it('si el conteo falla, items_count cae a 0 (no rompe la lista)', async () => {
      sourcesRepo.findAll.mockResolvedValue([
        scrapingSource({ id: 's1', name: 'a', kind: 'manual' }),
      ]);
      supabase._on(null, { message: 'boom' }, null);

      const result = await service.listSources();

      expect(result).toHaveLength(1);
      expect(result[0].items_count).toBe(0);
    });
  });

  describe('upsertSource', () => {
    it('delega al repo con los defaults aplicados', async () => {
      sourcesRepo.upsert.mockResolvedValue(
        scrapingSource({ id: 'new', name: 'x' }),
      );

      const result = await service.upsertSource({
        name: 'x',
        kind: 'manual',
      });

      expect(sourcesRepo.upsert.mock.calls[0]).toEqual([
        {
          name: 'x',
          kind: 'manual',
          config: {},
          enabled: true,
          schedule_cron: null,
        },
      ]);
      expect(result.id).toBe('new');
    });

    it('respeta los campos enabled / config / cron del caller', async () => {
      sourcesRepo.upsert.mockResolvedValue(scrapingSource({ id: 'x' }));

      await service.upsertSource({
        name: 'foo',
        kind: 'google_places',
        config: { lat: 10 },
        enabled: false,
        schedule_cron: '0 12 * * *',
      });

      expect(sourcesRepo.upsert.mock.calls[0]).toEqual([
        {
          name: 'foo',
          kind: 'google_places',
          config: { lat: 10 },
          enabled: false,
          schedule_cron: '0 12 * * *',
        },
      ]);
    });
  });

  describe('patchSource', () => {
    it('llama repo.patch con campos definidos solamente', async () => {
      sourcesRepo.findById.mockResolvedValue(scrapingSource({ id: 's1' }));
      sourcesRepo.patch.mockResolvedValue(
        scrapingSource({ id: 's1', enabled: false }),
      );

      const result = await service.patchSource('s1', { enabled: false });

      expect(sourcesRepo.findById.mock.calls[0]).toEqual(['s1']);
      expect(sourcesRepo.patch.mock.calls[0]).toEqual([
        's1',
        { enabled: false },
      ]);
      expect(result.enabled).toBe(false);
    });

    it('tira BadRequest si no se pasa ningun campo', async () => {
      sourcesRepo.findById.mockResolvedValue(scrapingSource({ id: 's1' }));

      await expect(service.patchSource('s1', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(sourcesRepo.patch).not.toHaveBeenCalled();
    });

    it('propaga NotFound si la source no existe', async () => {
      sourcesRepo.findById.mockRejectedValue(new NotFoundException('nope'));

      await expect(
        service.patchSource('missing', { enabled: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('runSourceNow', () => {
    it('delega en el executor con source_id + triggeredBy y devuelve el run', async () => {
      executor.runSource.mockResolvedValue(
        scrapingRun({
          id: 'r1',
          status: 'succeeded',
          triggered_by: 'admin-uid',
          items_found: 3,
          items_enriched: 3,
        }),
      );

      const result = await service.runSourceNow('s1', 'admin-uid');

      expect(executor.runSource.mock.calls[0]).toEqual(['s1', 'admin-uid']);
      expect(result.items_found).toBe(3);
    });

    it('propaga NotFound si la source no existe en la DB', async () => {
      executor.runSource.mockRejectedValue(new NotFoundException('nope'));

      await expect(service.runSourceNow('missing', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listRuns', () => {
    it('delega al repo con source_id + limit', async () => {
      runsRepo.listBySource.mockResolvedValue([
        scrapingRun({ id: 'r1', source_id: 's1', status: 'succeeded' }),
      ]);

      const result = await service.listRuns({ source_id: 's1', limit: 20 });

      expect(runsRepo.listBySource.mock.calls[0]).toEqual([
        {
          sourceId: 's1',
          limit: 20,
        },
      ]);
      expect(result).toHaveLength(1);
    });

    it('aplica defaults — limit=50, sin source_id', async () => {
      runsRepo.listBySource.mockResolvedValue([]);

      await service.listRuns({});

      expect(runsRepo.listBySource.mock.calls[0]).toEqual([
        {
          sourceId: undefined,
          limit: 50,
        },
      ]);
    });
  });

  describe('listItems', () => {
    it('por default lista pending con page=1 limit=50', async () => {
      itemsRepo.listByStatus.mockResolvedValue([enrichedItem({ id: 'i1' })]);

      const result = await service.listItems({});

      expect(itemsRepo.listByStatus.mock.calls[0]).toEqual([
        {
          status: 'pending',
          limit: 50,
          offset: 0,
        },
      ]);
      expect(result).toHaveLength(1);
    });

    it('aplica paginacion (offset = (page-1)*limit)', async () => {
      itemsRepo.listByStatus.mockResolvedValue([]);

      await service.listItems({ status: 'approved', page: 3, limit: 25 });

      expect(itemsRepo.listByStatus.mock.calls[0]).toEqual([
        {
          status: 'approved',
          limit: 25,
          offset: 50,
        },
      ]);
    });
  });

  describe('findItem', () => {
    it('devuelve el item si existe', async () => {
      itemsRepo.findById.mockResolvedValue(
        enrichedItem({ id: 'i1', title: 't' }),
      );

      const result = await service.findItem('i1');

      expect(result.id).toBe('i1');
    });

    it('propaga NotFound si el item no existe', async () => {
      itemsRepo.findById.mockRejectedValue(new NotFoundException('no'));

      await expect(service.findItem('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('patchItem', () => {
    it('llama repo.updateFields con los campos definidos', async () => {
      itemsRepo.findById.mockResolvedValue(enrichedItem({ id: 'i1' }));
      itemsRepo.updateFields.mockResolvedValue(
        enrichedItem({ id: 'i1', title: 'nuevo titulo' }),
      );

      const result = await service.patchItem('i1', {
        title: 'nuevo titulo',
        price_cop: 50000,
      });

      expect(itemsRepo.updateFields.mock.calls[0]).toEqual([
        'i1',
        {
          title: 'nuevo titulo',
          price_cop: 50000,
        } satisfies UpdateEnrichedFields,
      ]);
      expect(result.title).toBe('nuevo titulo');
    });

    it('tira BadRequest si dto vacio', async () => {
      itemsRepo.findById.mockResolvedValue(enrichedItem({ id: 'i1' }));

      await expect(service.patchItem('i1', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('approveItem', () => {
    it('mueve a approved con reviewer_id', async () => {
      itemsRepo.approve.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          status: 'approved',
          reviewed_by: 'admin-uid',
        }),
      );

      const result = await service.approveItem('i1', 'admin-uid');

      expect(itemsRepo.approve.mock.calls[0]).toEqual(['i1', 'admin-uid']);
      expect(result.status).toBe('approved');
    });
  });

  describe('rejectItem', () => {
    it('mueve a rejected con reviewer y razon', async () => {
      itemsRepo.reject.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          status: 'rejected',
          reviewed_by: 'admin-uid',
          rejection_reason: 'duplicado',
        }),
      );

      const result = await service.rejectItem('i1', 'admin-uid', 'duplicado');

      expect(itemsRepo.reject.mock.calls[0]).toEqual([
        'i1',
        'admin-uid',
        'duplicado',
      ]);
      expect(result.status).toBe('rejected');
    });

    it('acepta razon vacia o no provista (campo opcional)', async () => {
      itemsRepo.reject.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          status: 'rejected',
        }),
      );

      await service.rejectItem('i1', 'admin-uid', undefined);

      expect(itemsRepo.reject.mock.calls[0]).toEqual([
        'i1',
        'admin-uid',
        undefined,
      ]);
    });
  });

  describe('publishItem', () => {
    function mockInsertReturning(returnedId: string): MockChain {
      const chain = createChain({
        data: { id: returnedId },
        error: null,
      });
      supabase.from.mockReturnValueOnce(chain);
      return chain;
    }

    it('si category_hint es "restaurante" crea PLACE y enlaza published_place_id', async () => {
      itemsRepo.findById.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          title: 'La Trattoria',
          description: 'pasta',
          location_name: 'Calle 84',
          lat: 10.99,
          lng: -74.79,
          price_cop: 50000,
          category_hint: 'restaurante',
          source_kind: 'google_places',
          source_external_id: 'g-1',
          source_url: 'https://x.com',
          image_url: 'https://x.com/img.jpg',
          status: 'approved',
        }),
      );
      supabase._on(null);
      supabase._on(null);
      const insertChain = mockInsertReturning('place-new');
      itemsRepo.publish.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          status: 'published',
          published_place_id: 'place-new',
        }),
      );

      const result = await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledWith('places');
      const inserted = firstArg<PlaceInsertRow>(insertChain.insert);
      expect(inserted.name).toBe('La Trattoria');
      expect(inserted.description).toBe('pasta');
      expect(inserted.latitude).toBe(10.99);
      expect(inserted.longitude).toBe(-74.79);
      expect(inserted.source_kind).toBe('google_places');
      expect(inserted.source_external_id).toBe('g-1');
      expect(inserted.source_url).toBe('https://x.com');
      expect(inserted.data_provenance?.source).toEqual({
        kind: 'google_places',
        external_id: 'g-1',
        url: 'https://x.com',
        enriched_item_id: 'i1',
      });
      expect(itemsRepo.publish.mock.calls[0]).toEqual([
        'i1',
        {
          placeId: 'place-new',
        },
      ]);
      expect(result.published_place_id).toBe('place-new');
    });

    it('si category_hint es "bar" o "hotel" tambien crea PLACE', async () => {
      itemsRepo.findById.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          title: 'Bar X',
          category_hint: 'bar',
          lat: 10,
          lng: -74,
        }),
      );
      mockInsertReturning('place-bar');
      itemsRepo.publish.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          status: 'published',
          published_place_id: 'place-bar',
        }),
      );

      await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledWith('places');
      expect(itemsRepo.publish.mock.calls[0]).toEqual([
        'i1',
        {
          placeId: 'place-bar',
        },
      ]);
    });

    it('si category_hint es "tour" crea EXPERIENCE y enlaza published_experience_id', async () => {
      itemsRepo.findById.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          title: 'Tour mural Centro',
          description: 'recorrido',
          location_name: 'Centro',
          lat: 10.99,
          lng: -74.79,
          price_cop: 80000,
          category_hint: 'tour',
          starts_at: '2026-07-01T15:00:00Z',
          ends_at: '2026-07-01T18:00:00Z',
          status: 'approved',
        }),
      );
      const insertChain = mockInsertReturning('exp-new');
      itemsRepo.publish.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          status: 'published',
          published_experience_id: 'exp-new',
        }),
      );

      const result = await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledWith('experiences');
      const inserted = firstArg<ExperienceInsertRow>(insertChain.insert);
      expect(inserted.title).toBe('Tour mural Centro');
      expect(inserted.price_cop).toBe(80000);
      expect(inserted.duration_minutes).toBe(180);
      expect(itemsRepo.publish.mock.calls[0]).toEqual([
        'i1',
        {
          experienceId: 'exp-new',
        },
      ]);
      expect(result.published_experience_id).toBe('exp-new');
    });

    it('si category_hint es "evento" o "workshop" tambien crea EXPERIENCE', async () => {
      itemsRepo.findById.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          title: 'Workshop salsa',
          category_hint: 'workshop',
          price_cop: 30000,
        }),
      );
      mockInsertReturning('exp-w');
      itemsRepo.publish.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          status: 'published',
          published_experience_id: 'exp-w',
        }),
      );

      await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledWith('experiences');
      expect(itemsRepo.publish.mock.calls[0]).toEqual([
        'i1',
        {
          experienceId: 'exp-w',
        },
      ]);
    });

    it('si category_hint es desconocido cae en PLACE por default', async () => {
      itemsRepo.findById.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          title: 'Misterio',
          category_hint: 'algo-raro',
          lat: 10,
          lng: -74,
        }),
      );
      mockInsertReturning('place-def');
      itemsRepo.publish.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          status: 'published',
          published_place_id: 'place-def',
        }),
      );

      await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledWith('places');
      expect(itemsRepo.publish.mock.calls[0]).toEqual([
        'i1',
        {
          placeId: 'place-def',
        },
      ]);
    });

    it('si category_hint es null cae en PLACE por default', async () => {
      itemsRepo.findById.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          title: 'Lugar X',
          category_hint: null,
          lat: 10,
          lng: -74,
        }),
      );
      mockInsertReturning('place-null');
      itemsRepo.publish.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          status: 'published',
          published_place_id: 'place-null',
        }),
      );

      await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledWith('places');
    });

    it('si ya existe un place con la misma identidad externa, lo reutiliza', async () => {
      itemsRepo.findById.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          title: 'Castillo de San Felipe',
          category_hint: 'lugar',
          source_kind: 'google_places',
          source_external_id: 'ChIJ123',
          source_url: 'https://maps.google.com/?cid=123',
          status: 'approved',
        }),
      );
      supabase._on({ id: 'place-existing' });
      itemsRepo.publish.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          status: 'published',
          published_place_id: 'place-existing',
        }),
      );

      const result = await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledTimes(1);
      expect(itemsRepo.publish.mock.calls[0]).toEqual([
        'i1',
        {
          placeId: 'place-existing',
        },
      ]);
      expect(result.published_place_id).toBe('place-existing');
    });

    it('si no hay identidad externa, deduplica por source_url', async () => {
      itemsRepo.findById.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          title: 'Lugar con URL',
          category_hint: 'restaurante',
          source_kind: null,
          source_external_id: null,
          source_url: 'https://maps.google.com/?cid=999',
          status: 'approved',
        }),
      );
      supabase._on({ id: 'place-by-url' });
      itemsRepo.publish.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          status: 'published',
          published_place_id: 'place-by-url',
        }),
      );

      await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledTimes(1);
      expect(itemsRepo.publish.mock.calls[0]).toEqual([
        'i1',
        {
          placeId: 'place-by-url',
        },
      ]);
    });

    it('rechaza publicar si el item esta en status=rejected', async () => {
      itemsRepo.findById.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          title: 'x',
          category_hint: 'restaurante',
          status: 'rejected',
        }),
      );

      await expect(service.publishItem('i1')).rejects.toThrow(
        BadRequestException,
      );
      expect(itemsRepo.publish).not.toHaveBeenCalled();
    });

    it('si el insert en places/experiences falla, NO marca el item como published', async () => {
      itemsRepo.findById.mockResolvedValue(
        enrichedItem({
          id: 'i1',
          title: 'x',
          category_hint: 'restaurante',
          lat: 10,
          lng: -74,
          status: 'approved',
        }),
      );
      const failChain = createChain({
        data: null,
        error: { message: 'duplicate slug' },
      });
      supabase.from.mockReturnValueOnce(failChain);

      await expect(service.publishItem('i1')).rejects.toThrow(
        BadRequestException,
      );
      expect(itemsRepo.publish).not.toHaveBeenCalled();
    });

    it('propaga NotFound si el item no existe', async () => {
      itemsRepo.findById.mockRejectedValue(new NotFoundException('no'));

      await expect(service.publishItem('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

function scrapingSource(
  overrides: Partial<ScrapingSource> = {},
): ScrapingSource {
  return {
    id: 's1',
    name: 'source',
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
    id: 'r1',
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

function enrichedItem(
  overrides: Partial<ScrapedItemEnriched> = {},
): ScrapedItemEnriched {
  return {
    id: 'i1',
    raw_id: 'raw-1',
    title: 'Item',
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
