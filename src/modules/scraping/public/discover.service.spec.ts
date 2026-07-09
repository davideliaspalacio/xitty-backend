import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { SupabaseClient } from '@supabase/supabase-js';

import { DiscoverService } from './discover.service';

interface MockDbError {
  message: string;
}

interface MockDbResult {
  data: unknown;
  error: MockDbError | null;
  count: number | null;
}

type ChainMethod = jest.MockedFunction<(...args: unknown[]) => MockChain>;

interface MockChain extends PromiseLike<MockDbResult> {
  from: ChainMethod;
  select: ChainMethod;
  insert: ChainMethod;
  update: ChainMethod;
  delete: ChainMethod;
  eq: ChainMethod;
  neq: ChainMethod;
  ilike: ChainMethod;
  in: ChainMethod;
  not: ChainMethod;
  or: ChainMethod;
  order: ChainMethod;
  range: ChainMethod;
  limit: ChainMethod;
  single: ChainMethod;
  maybeSingle: ChainMethod;
}

interface MockSupabase {
  from: ChainMethod;
  _on: (data: unknown, error?: MockDbError, count?: number) => MockChain;
}

interface CuratedRow {
  id: string;
  title: string;
  description: string | null;
  category_hint: string | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  price_cop: number | null;
  image_url: string | null;
  source_url: string | null;
  quality_score: number | null;
  status: string;
  scraped_at?: string | null;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
  scraped_items_raw?: { scraped_at: string | null } | null;
}

function createChain(result: MockDbResult): MockChain {
  const chain = {} as MockChain;
  const methods = [
    'from',
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'ilike',
    'in',
    'not',
    'or',
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
    _on: (data: unknown, error?: MockDbError, count?: number) => {
      const c = createChain({
        data,
        error: error ?? null,
        count: count ?? null,
      });
      mock.from.mockReturnValueOnce(c);
      return c;
    },
  };
  mock.from.mockImplementation(() =>
    createChain({ data: null, error: null, count: null }),
  );
  return mock;
}

function curatedRow(overrides: Partial<CuratedRow> = {}): CuratedRow {
  return {
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
    created_at: '2026-06-10T00:00:00Z',
    starts_at: null,
    ends_at: null,
    ...overrides,
  };
}

describe('DiscoverService', () => {
  let service: DiscoverService;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoverService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
      ],
    }).compile();

    service = module.get<DiscoverService>(DiscoverService);
  });

  describe('findCurated', () => {
    it('devuelve solo items con status="published"', async () => {
      const chain = supabase._on([
        curatedRow({
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
          scraped_at: '2026-06-01T00:00:00Z',
        }),
      ]);

      const result = await service.findCurated({ limit: 10 });

      expect(result).toHaveLength(1);
      expect(supabase.from.mock.calls[0]).toEqual(['scraped_items_enriched']);
      expect(chain.eq.mock.calls).toContainEqual(['status', 'published']);
    });

    it('ordena por quality_score DESC y luego created_at DESC', async () => {
      const chain = supabase._on([
        curatedRow({
          id: 'a',
          title: 'a',
          quality_score: 0.9,
          created_at: 't2',
        }),
        curatedRow({
          id: 'b',
          title: 'b',
          quality_score: 0.9,
          created_at: 't1',
        }),
        curatedRow({
          id: 'c',
          title: 'c',
          quality_score: 0.5,
          created_at: 't3',
        }),
      ]);

      await service.findCurated({ limit: 50 });

      const calls = chain.order.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect(calls[0]).toEqual([
        'quality_score',
        { ascending: false, nullsFirst: false },
      ]);
      expect(calls[1]).toEqual(['created_at', { ascending: false }]);
    });

    it('aplica filtro por category cuando se pasa', async () => {
      const chain = supabase._on([]);

      await service.findCurated({ limit: 20, category: 'evento' });

      const calledWithCategory = chain.eq.mock.calls.some(
        ([field, value]) => field === 'category_hint' && value === 'evento',
      );
      expect(calledWithCategory).toBe(true);
    });

    it('respeta limit (default 20, max 100)', async () => {
      const chain1 = supabase._on([]);
      await service.findCurated({});
      expect(chain1.range.mock.calls[0]).toEqual([0, 19]);

      const chain2 = supabase._on([]);
      await service.findCurated({ limit: 5 });
      expect(chain2.range.mock.calls[0]).toEqual([0, 4]);

      const chain3 = supabase._on([]);
      await service.findCurated({ limit: 999 });
      expect(chain3.range.mock.calls[0]).toEqual([0, 99]);
    });

    it('mapea el item al formato de card (id, title, description, image, location, score, source)', async () => {
      supabase._on([
        curatedRow({
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
        }),
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
      expect(
        Object.prototype.hasOwnProperty.call(result[0], 'source_url'),
      ).toBe(false);
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

  describe('findCuratedById', () => {
    it('devuelve detalle con source_url, quality_score y scraped_at', async () => {
      supabase._on(
        curatedRow({
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
          starts_at: '2026-07-01T10:00:00Z',
          ends_at: '2026-07-01T12:00:00Z',
          scraped_items_raw: { scraped_at: '2026-06-01T00:00:00Z' },
        }),
      );

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
      supabase._on(null);

      await expect(service.findCuratedById('pending-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('filtra por status="published" en la query', async () => {
      const chain = supabase._on(
        curatedRow({
          id: 'e1',
          title: 't',
          quality_score: 0.5,
          scraped_items_raw: { scraped_at: 'ts' },
        }),
      );

      await service.findCuratedById('e1');

      const filteredById = chain.eq.mock.calls.some(
        ([field, value]) => field === 'id' && value === 'e1',
      );
      const filteredByStatus = chain.eq.mock.calls.some(
        ([field, value]) => field === 'status' && value === 'published',
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
