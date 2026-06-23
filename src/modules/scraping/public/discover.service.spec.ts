import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { DiscoverService } from './discover.service';

// ── Supabase mock (mismo patron usado en places/scraping) ───────────────
function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'ilike', 'in', 'not', 'or', 'order', 'range', 'limit',
    'single', 'maybeSingle',
  ];
  methods.forEach((m) => (chain[m] = jest.fn().mockReturnValue(chain)));
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createMockSupabase() {
  const mock: any = { from: jest.fn() };
  mock._on = (data: any, error?: any, count?: number) => {
    const c = createChain({ data, error: error || null, count: count ?? null });
    mock.from.mockReturnValueOnce(c);
    return c;
  };
  mock.from.mockImplementation(() =>
    createChain({ data: null, error: null, count: null }),
  );
  return mock;
}

describe('DiscoverService', () => {
  let service: DiscoverService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoverService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();

    service = module.get<DiscoverService>(DiscoverService);
  });

  // ────────────────────────────────────────────────────────────────────────
  // findCurated
  // ────────────────────────────────────────────────────────────────────────
  describe('findCurated', () => {
    it('devuelve solo items con status="published"', async () => {
      const chain = supabase._on([
        {
          id: 'e1',
          title: 'Festival Carnaval',
          description: 'desc',
          category_hint: 'evento',
          location_name: 'Centro',
          lat: 10.99,
          lng: -74.78,
          image_url: 'https://img/x.jpg',
          source_url: 'https://src/y',
          quality_score: 0.95,
          status: 'published',
          scraped_at: '2026-06-01T00:00:00Z',
          created_at: '2026-06-10T00:00:00Z',
        },
      ]);

      const result = await service.findCurated({ limit: 10 });

      expect(result).toHaveLength(1);
      expect(supabase.from).toHaveBeenCalledWith('scraped_items_enriched');
      expect(chain.eq).toHaveBeenCalledWith('status', 'published');
    });

    it('ordena por quality_score DESC y luego created_at DESC', async () => {
      const chain = supabase._on([
        { id: 'a', title: 'a', quality_score: 0.9, created_at: 't2', status: 'published' },
        { id: 'b', title: 'b', quality_score: 0.9, created_at: 't1', status: 'published' },
        { id: 'c', title: 'c', quality_score: 0.5, created_at: 't3', status: 'published' },
      ]);

      await service.findCurated({ limit: 50 });

      // El primer order() debe ser quality_score DESC; el segundo created_at DESC.
      const calls = chain.order.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect(calls[0]).toEqual(['quality_score', { ascending: false, nullsFirst: false }]);
      expect(calls[1]).toEqual(['created_at', { ascending: false }]);
    });

    it('aplica filtro por category cuando se pasa', async () => {
      const chain = supabase._on([]);

      await service.findCurated({ limit: 20, category: 'evento' });

      // Debe filtrar por category_hint
      const eqCalls = chain.eq.mock.calls;
      const calledWithCategory = eqCalls.some(
        (args: any[]) => args[0] === 'category_hint' && args[1] === 'evento',
      );
      expect(calledWithCategory).toBe(true);
    });

    it('respeta limit (default 20, max 100)', async () => {
      // sin limit explicito → default 20
      const chain1 = supabase._on([]);
      await service.findCurated({} as any);
      expect(chain1.range).toHaveBeenCalledWith(0, 19);

      // limit explicito
      const chain2 = supabase._on([]);
      await service.findCurated({ limit: 5 });
      expect(chain2.range).toHaveBeenCalledWith(0, 4);

      // limit que excede el maximo → se trunca a 100
      const chain3 = supabase._on([]);
      await service.findCurated({ limit: 999 });
      expect(chain3.range).toHaveBeenCalledWith(0, 99);
    });

    it('mapea el item al formato de card (id, title, description, image, location, score, source)', async () => {
      supabase._on([
        {
          id: 'e1',
          title: 'Tour mural',
          description: 'desc bonita',
          category_hint: 'tour',
          location_name: 'Centro Historico',
          lat: 10.99,
          lng: -74.78,
          price_cop: 50000,
          image_url: 'https://img/x.jpg',
          source_url: 'https://src/y',
          quality_score: 0.85,
          status: 'published',
          scraped_at: '2026-06-01T00:00:00Z',
          created_at: '2026-06-10T00:00:00Z',
          starts_at: null,
          ends_at: null,
        },
      ]);

      const result = await service.findCurated({ limit: 10 });

      expect(result[0]).toMatchObject({
        id: 'e1',
        title: 'Tour mural',
        description: 'desc bonita',
        category: 'tour',
        location_name: 'Centro Historico',
        latitude: 10.99,
        longitude: -74.78,
        price_cop: 50000,
        image_url: 'https://img/x.jpg',
        quality_score: 0.85,
      });
      // El listado NO expone source_url (eso es solo en el detalle)
      expect((result[0] as any).source_url).toBeUndefined();
    });

    it('tira BadRequestException si supabase falla', async () => {
      supabase._on(null, { message: 'db down' });
      await expect(service.findCurated({ limit: 10 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('devuelve [] si supabase no devuelve nada', async () => {
      supabase._on(null);
      const result = await service.findCurated({ limit: 10 });
      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // findCuratedById
  // ────────────────────────────────────────────────────────────────────────
  describe('findCuratedById', () => {
    it('devuelve detalle con source_url, quality_score y scraped_at', async () => {
      // primero busca el enriched (con join al raw para sacar scraped_at)
      supabase._on({
        id: 'e1',
        title: 'Tour mural',
        description: 'desc',
        category_hint: 'tour',
        location_name: 'Centro',
        lat: 10.99,
        lng: -74.78,
        price_cop: 50000,
        image_url: 'https://img/x.jpg',
        source_url: 'https://src/y',
        quality_score: 0.85,
        status: 'published',
        starts_at: '2026-07-01T10:00:00Z',
        ends_at: '2026-07-01T12:00:00Z',
        created_at: '2026-06-10T00:00:00Z',
        scraped_items_raw: { scraped_at: '2026-06-01T00:00:00Z' },
      });

      const result = await service.findCuratedById('e1');

      expect(result.id).toBe('e1');
      expect(result.source_url).toBe('https://src/y');
      expect(result.quality_score).toBe(0.85);
      expect(result.scraped_at).toBe('2026-06-01T00:00:00Z');
      expect(result.title).toBe('Tour mural');
    });

    it('tira NotFoundException si el item no existe', async () => {
      supabase._on(null);
      await expect(service.findCuratedById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('tira NotFoundException si el item existe pero no esta published', async () => {
      // un item con status=pending NO debe ser visible en el feed publico
      supabase._on(null); // la query filtra status='published' en .eq()
      await expect(service.findCuratedById('pending-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('filtra por status="published" en la query', async () => {
      const chain = supabase._on({
        id: 'e1',
        title: 't',
        status: 'published',
        quality_score: 0.5,
        scraped_items_raw: { scraped_at: 'ts' },
      });

      await service.findCuratedById('e1');

      const eqCalls = chain.eq.mock.calls;
      const filteredById = eqCalls.some(
        (args: any[]) => args[0] === 'id' && args[1] === 'e1',
      );
      const filteredByStatus = eqCalls.some(
        (args: any[]) => args[0] === 'status' && args[1] === 'published',
      );
      expect(filteredById).toBe(true);
      expect(filteredByStatus).toBe(true);
    });

    it('tira BadRequestException si supabase devuelve un error real', async () => {
      supabase._on(null, { message: 'db down' });
      await expect(service.findCuratedById('e1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
