import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { AdminScrapingService } from './admin-scraping.service';
import { ScrapingSourcesRepo } from '../storage/scraping-sources.repo';
import { ScrapingRunsRepo } from '../storage/scraping-runs.repo';
import { ScrapedItemsRepo } from '../storage/scraped-items.repo';
import { ScrapingExecutorService } from '../executor/scraping-executor.service';

// ── Supabase chain mock (mismo patron usado en el resto del modulo) ──────────
function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'order', 'range', 'limit',
    'single', 'maybeSingle',
  ];
  methods.forEach((m) => (chain[m] = jest.fn().mockReturnValue(chain)));
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createMockSupabase() {
  const mock: any = { from: jest.fn(), rpc: jest.fn() };
  mock._on = (data: any, error?: any) => {
    const c = createChain({ data, error: error || null });
    mock.from.mockReturnValueOnce(c);
    return c;
  };
  mock.from.mockImplementation(() => createChain({ data: null, error: null }));
  return mock;
}

describe('AdminScrapingService', () => {
  let service: AdminScrapingService;
  let supabase: any;
  let sourcesRepo: jest.Mocked<ScrapingSourcesRepo>;
  let runsRepo: jest.Mocked<ScrapingRunsRepo>;
  let itemsRepo: jest.Mocked<ScrapedItemsRepo>;
  let executor: jest.Mocked<ScrapingExecutorService>;

  beforeEach(async () => {
    supabase = createMockSupabase();

    sourcesRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      upsert: jest.fn(),
      markRun: jest.fn(),
      patch: jest.fn(),
    } as any;

    runsRepo = {
      start: jest.fn(),
      finish: jest.fn(),
      error: jest.fn(),
      listBySource: jest.fn(),
    } as any;

    itemsRepo = {
      insertRaw: jest.fn(),
      dedupCheck: jest.fn(),
      insertEnriched: jest.fn(),
      listPending: jest.fn(),
      listByStatus: jest.fn(),
      findById: jest.fn(),
      updateFields: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      publish: jest.fn(),
      computeDedupHash: jest.fn(),
    } as any;

    executor = {
      runSource: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminScrapingService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
        { provide: ScrapingSourcesRepo, useValue: sourcesRepo },
        { provide: ScrapingRunsRepo, useValue: runsRepo },
        { provide: ScrapedItemsRepo, useValue: itemsRepo },
        { provide: ScrapingExecutorService, useValue: executor },
      ],
    }).compile();

    service = module.get(AdminScrapingService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // listSources — incluye last_run + items_count
  // ─────────────────────────────────────────────────────────────────────────
  describe('listSources', () => {
    it('devuelve lista con last_run_at y items_count agregado', async () => {
      sourcesRepo.findAll.mockResolvedValue([
        {
          id: 's1',
          name: 'foursquare',
          kind: 'google_places',
          config: {},
          enabled: true,
          schedule_cron: null,
          last_run_at: '2026-06-20T00:00:00Z',
          created_at: 't',
          updated_at: 't',
        },
        {
          id: 's2',
          name: 'eventbrite',
          kind: 'eventbrite',
          config: {},
          enabled: false,
          schedule_cron: null,
          last_run_at: null,
          created_at: 't',
          updated_at: 't',
        },
      ] as any);

      // mock count por source — el service usa supabase.from('scraped_items_raw')
      // con select count para cada source_id
      supabase._on(null);
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ count: 12, data: null, error: null }),
        }),
      });

      const result = await service.listSources();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('s1');
      expect(result[0].last_run_at).toBe('2026-06-20T00:00:00Z');
      expect(typeof result[0].items_count).toBe('number');
      expect(sourcesRepo.findAll).toHaveBeenCalled();
    });

    it('si el conteo falla, items_count cae a 0 (no rompe la lista)', async () => {
      sourcesRepo.findAll.mockResolvedValue([
        {
          id: 's1', name: 'a', kind: 'manual', config: {}, enabled: true,
          schedule_cron: null, last_run_at: null,
          created_at: 't', updated_at: 't',
        } as any,
      ]);
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ count: null, data: null, error: { message: 'boom' } }),
        }),
      });

      const result = await service.listSources();

      expect(result).toHaveLength(1);
      expect(result[0].items_count).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // upsertSource
  // ─────────────────────────────────────────────────────────────────────────
  describe('upsertSource', () => {
    it('delega al repo con los defaults aplicados', async () => {
      sourcesRepo.upsert.mockResolvedValue({
        id: 'new', name: 'x', kind: 'manual', config: {}, enabled: true,
        schedule_cron: null, last_run_at: null,
        created_at: 't', updated_at: 't',
      } as any);

      const result = await service.upsertSource({
        name: 'x',
        kind: 'manual',
      });

      expect(sourcesRepo.upsert).toHaveBeenCalledWith({
        name: 'x',
        kind: 'manual',
        config: {},
        enabled: true,
        schedule_cron: null,
      });
      expect(result.id).toBe('new');
    });

    it('respeta los campos enabled / config / cron del caller', async () => {
      sourcesRepo.upsert.mockResolvedValue({ id: 'x' } as any);

      await service.upsertSource({
        name: 'foo',
        kind: 'google_places',
        config: { lat: 10 },
        enabled: false,
        schedule_cron: '0 12 * * *',
      });

      expect(sourcesRepo.upsert).toHaveBeenCalledWith({
        name: 'foo',
        kind: 'google_places',
        config: { lat: 10 },
        enabled: false,
        schedule_cron: '0 12 * * *',
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // patchSource — toggle enabled / schedule
  // ─────────────────────────────────────────────────────────────────────────
  describe('patchSource', () => {
    it('llama repo.patch con campos definidos solamente', async () => {
      sourcesRepo.findById.mockResolvedValue({ id: 's1' } as any);
      sourcesRepo.patch.mockResolvedValue({ id: 's1', enabled: false } as any);

      const result = await service.patchSource('s1', { enabled: false });

      expect(sourcesRepo.findById).toHaveBeenCalledWith('s1');
      expect(sourcesRepo.patch).toHaveBeenCalledWith('s1', { enabled: false });
      expect(result.enabled).toBe(false);
    });

    it('tira BadRequest si no se pasa ningun campo', async () => {
      sourcesRepo.findById.mockResolvedValue({ id: 's1' } as any);
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

  // ─────────────────────────────────────────────────────────────────────────
  // runSourceNow — disparar run manual
  // ─────────────────────────────────────────────────────────────────────────
  describe('runSourceNow', () => {
    it('delega en el executor con source_id + triggeredBy y devuelve el run', async () => {
      executor.runSource.mockResolvedValue({
        id: 'r1',
        source_id: 's1',
        status: 'succeeded',
        triggered_by: 'admin-uid',
        items_found: 3,
        items_enriched: 3,
        items_failed: 0,
        error: null,
        started_at: 't',
        finished_at: 't',
      } as any);

      const result = await service.runSourceNow('s1', 'admin-uid');

      expect(executor.runSource).toHaveBeenCalledWith('s1', 'admin-uid');
      expect(result.items_found).toBe(3);
    });

    it('propaga NotFound si la source no existe en la DB', async () => {
      executor.runSource.mockRejectedValue(new NotFoundException('nope'));
      await expect(service.runSourceNow('missing', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // listRuns (historial)
  // ─────────────────────────────────────────────────────────────────────────
  describe('listRuns', () => {
    it('delega al repo con source_id + limit', async () => {
      runsRepo.listBySource.mockResolvedValue([
        { id: 'r1', source_id: 's1', status: 'succeeded' } as any,
      ]);
      const result = await service.listRuns({ source_id: 's1', limit: 20 });
      expect(runsRepo.listBySource).toHaveBeenCalledWith({
        sourceId: 's1',
        limit: 20,
      });
      expect(result).toHaveLength(1);
    });

    it('aplica defaults — limit=50, sin source_id', async () => {
      runsRepo.listBySource.mockResolvedValue([]);
      await service.listRuns({});
      expect(runsRepo.listBySource).toHaveBeenCalledWith({
        sourceId: undefined,
        limit: 50,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // listItems — cola de moderacion
  // ─────────────────────────────────────────────────────────────────────────
  describe('listItems', () => {
    it('por default lista pending con page=1 limit=50', async () => {
      itemsRepo.listByStatus.mockResolvedValue([{ id: 'i1' } as any]);
      const result = await service.listItems({});
      expect(itemsRepo.listByStatus).toHaveBeenCalledWith({
        status: 'pending',
        limit: 50,
        offset: 0,
      });
      expect(result).toHaveLength(1);
    });

    it('aplica paginacion (offset = (page-1)*limit)', async () => {
      itemsRepo.listByStatus.mockResolvedValue([]);
      await service.listItems({ status: 'approved', page: 3, limit: 25 });
      expect(itemsRepo.listByStatus).toHaveBeenCalledWith({
        status: 'approved',
        limit: 25,
        offset: 50,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findItem
  // ─────────────────────────────────────────────────────────────────────────
  describe('findItem', () => {
    it('devuelve el item si existe', async () => {
      itemsRepo.findById.mockResolvedValue({ id: 'i1', title: 't' } as any);
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

  // ─────────────────────────────────────────────────────────────────────────
  // patchItem — edicion manual desde el panel
  // ─────────────────────────────────────────────────────────────────────────
  describe('patchItem', () => {
    it('llama repo.updateFields con los campos definidos', async () => {
      itemsRepo.findById.mockResolvedValue({ id: 'i1' } as any);
      itemsRepo.updateFields.mockResolvedValue({
        id: 'i1', title: 'nuevo titulo',
      } as any);

      const result = await service.patchItem('i1', {
        title: 'nuevo titulo',
        price_cop: 50000,
      });

      expect(itemsRepo.updateFields).toHaveBeenCalledWith('i1', {
        title: 'nuevo titulo',
        price_cop: 50000,
      });
      expect(result.title).toBe('nuevo titulo');
    });

    it('tira BadRequest si dto vacio', async () => {
      itemsRepo.findById.mockResolvedValue({ id: 'i1' } as any);
      await expect(service.patchItem('i1', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // approveItem
  // ─────────────────────────────────────────────────────────────────────────
  describe('approveItem', () => {
    it('mueve a approved con reviewer_id', async () => {
      itemsRepo.approve.mockResolvedValue({
        id: 'i1', status: 'approved', reviewed_by: 'admin-uid',
      } as any);

      const result = await service.approveItem('i1', 'admin-uid');

      expect(itemsRepo.approve).toHaveBeenCalledWith('i1', 'admin-uid');
      expect(result.status).toBe('approved');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // rejectItem (con razon)
  // ─────────────────────────────────────────────────────────────────────────
  describe('rejectItem', () => {
    it('mueve a rejected con reviewer y razon', async () => {
      itemsRepo.reject.mockResolvedValue({
        id: 'i1', status: 'rejected', reviewed_by: 'admin-uid',
        rejection_reason: 'duplicado',
      } as any);

      const result = await service.rejectItem('i1', 'admin-uid', 'duplicado');

      expect(itemsRepo.reject).toHaveBeenCalledWith(
        'i1',
        'admin-uid',
        'duplicado',
      );
      expect(result.status).toBe('rejected');
    });

    it('acepta razon vacia o no provista (campo opcional)', async () => {
      itemsRepo.reject.mockResolvedValue({
        id: 'i1', status: 'rejected',
      } as any);
      await service.rejectItem('i1', 'admin-uid', undefined);
      expect(itemsRepo.reject).toHaveBeenCalledWith(
        'i1',
        'admin-uid',
        undefined,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // publishItem — crea place o experience segun category_hint
  // ─────────────────────────────────────────────────────────────────────────
  describe('publishItem', () => {
    /**
     * Helper: simula la cadena .insert(...).select(...).single() de supabase
     * devolviendo `data` con id `returnedId`.
     */
    function mockInsertReturning(returnedId: string) {
      const chain = createChain({
        data: { id: returnedId },
        error: null,
      });
      supabase.from.mockReturnValueOnce(chain);
      return chain;
    }

    it('si category_hint es "restaurante" crea PLACE y enlaza published_place_id', async () => {
      itemsRepo.findById.mockResolvedValue({
        id: 'i1',
        title: 'La Trattoria',
        description: 'pasta',
        location_name: 'Calle 84',
        lat: 10.99, lng: -74.79,
        price_cop: 50000,
        category_hint: 'restaurante',
        starts_at: null, ends_at: null,
        source_url: 'https://x.com',
        image_url: 'https://x.com/img.jpg',
        status: 'approved',
      } as any);

      const insertChain = mockInsertReturning('place-new');
      itemsRepo.publish.mockResolvedValue({
        id: 'i1', status: 'published', published_place_id: 'place-new',
      } as any);

      const result = await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledWith('places');
      const inserted = insertChain.insert.mock.calls[0][0];
      expect(inserted.name).toBe('La Trattoria');
      expect(inserted.description).toBe('pasta');
      expect(inserted.latitude).toBe(10.99);
      expect(inserted.longitude).toBe(-74.79);
      expect(itemsRepo.publish).toHaveBeenCalledWith('i1', {
        placeId: 'place-new',
      });
      expect(result.published_place_id).toBe('place-new');
    });

    it('si category_hint es "bar" o "hotel" tambien crea PLACE', async () => {
      itemsRepo.findById.mockResolvedValue({
        id: 'i1', title: 'Bar X', category_hint: 'bar',
        lat: 10, lng: -74,
      } as any);
      mockInsertReturning('place-bar');
      itemsRepo.publish.mockResolvedValue({
        id: 'i1', status: 'published', published_place_id: 'place-bar',
      } as any);

      await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledWith('places');
      expect(itemsRepo.publish).toHaveBeenCalledWith('i1', {
        placeId: 'place-bar',
      });
    });

    it('si category_hint es "tour" crea EXPERIENCE y enlaza published_experience_id', async () => {
      itemsRepo.findById.mockResolvedValue({
        id: 'i1',
        title: 'Tour mural Centro',
        description: 'recorrido',
        location_name: 'Centro',
        lat: 10.99, lng: -74.79,
        price_cop: 80000,
        category_hint: 'tour',
        starts_at: '2026-07-01T15:00:00Z',
        ends_at: '2026-07-01T18:00:00Z',
        status: 'approved',
      } as any);

      const insertChain = mockInsertReturning('exp-new');
      itemsRepo.publish.mockResolvedValue({
        id: 'i1', status: 'published', published_experience_id: 'exp-new',
      } as any);

      const result = await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledWith('experiences');
      const inserted = insertChain.insert.mock.calls[0][0];
      expect(inserted.title).toBe('Tour mural Centro');
      expect(inserted.price_cop).toBe(80000);
      // 3h entre starts y ends → 180 min
      expect(inserted.duration_minutes).toBe(180);
      expect(itemsRepo.publish).toHaveBeenCalledWith('i1', {
        experienceId: 'exp-new',
      });
      expect(result.published_experience_id).toBe('exp-new');
    });

    it('si category_hint es "evento" o "workshop" tambien crea EXPERIENCE', async () => {
      itemsRepo.findById.mockResolvedValue({
        id: 'i1', title: 'Workshop salsa', category_hint: 'workshop',
        price_cop: 30000,
      } as any);
      mockInsertReturning('exp-w');
      itemsRepo.publish.mockResolvedValue({
        id: 'i1', status: 'published', published_experience_id: 'exp-w',
      } as any);

      await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledWith('experiences');
      expect(itemsRepo.publish).toHaveBeenCalledWith('i1', {
        experienceId: 'exp-w',
      });
    });

    it('si category_hint es desconocido cae en PLACE por default', async () => {
      itemsRepo.findById.mockResolvedValue({
        id: 'i1', title: 'Misterio', category_hint: 'algo-raro',
        lat: 10, lng: -74,
      } as any);
      mockInsertReturning('place-def');
      itemsRepo.publish.mockResolvedValue({
        id: 'i1', status: 'published', published_place_id: 'place-def',
      } as any);

      await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledWith('places');
      expect(itemsRepo.publish).toHaveBeenCalledWith('i1', {
        placeId: 'place-def',
      });
    });

    it('si category_hint es null cae en PLACE por default', async () => {
      itemsRepo.findById.mockResolvedValue({
        id: 'i1', title: 'Lugar X', category_hint: null,
        lat: 10, lng: -74,
      } as any);
      mockInsertReturning('place-null');
      itemsRepo.publish.mockResolvedValue({
        id: 'i1', status: 'published', published_place_id: 'place-null',
      } as any);

      await service.publishItem('i1');

      expect(supabase.from).toHaveBeenCalledWith('places');
    });

    it('rechaza publicar si el item esta en status=rejected', async () => {
      itemsRepo.findById.mockResolvedValue({
        id: 'i1', title: 'x', category_hint: 'restaurante',
        status: 'rejected',
      } as any);

      await expect(service.publishItem('i1')).rejects.toThrow(
        BadRequestException,
      );
      expect(itemsRepo.publish).not.toHaveBeenCalled();
    });

    it('si el insert en places/experiences falla, NO marca el item como published', async () => {
      itemsRepo.findById.mockResolvedValue({
        id: 'i1', title: 'x', category_hint: 'restaurante',
        lat: 10, lng: -74,
        status: 'approved',
      } as any);

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
