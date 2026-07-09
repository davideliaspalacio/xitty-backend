import { Test, TestingModule } from '@nestjs/testing';
import type { SupabaseClient } from '@supabase/supabase-js';

import { RecommendationsService } from './recommendations.service';

// ── Supabase mock ─────────────────────────────────────────────────────────
// Chain builder for `.from(...).select(...).in(...)...` queries.
interface MockDbError {
  message: string;
}

interface MockDbResult {
  data: unknown;
  error: MockDbError | null;
}

type ChainMethod = jest.MockedFunction<(...args: unknown[]) => MockChain>;
type RpcMethod = jest.MockedFunction<
  (...args: unknown[]) => Promise<MockDbResult>
>;

interface MockChain extends PromiseLike<MockDbResult> {
  from: ChainMethod;
  select: ChainMethod;
  insert: ChainMethod;
  update: ChainMethod;
  delete: ChainMethod;
  eq: ChainMethod;
  in: ChainMethod;
  order: ChainMethod;
  limit: ChainMethod;
  single: ChainMethod;
  maybeSingle: ChainMethod;
}

interface MockSupabase {
  from: ChainMethod;
  rpc: RpcMethod;
  _on: (data: unknown, error?: MockDbError | null) => MockChain;
  _onRpc: (data: unknown, error?: MockDbError | null) => void;
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
    'in',
    'order',
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
    rpc: jest.fn<(...args: unknown[]) => Promise<MockDbResult>>(),
    _on: (data: unknown, error?: MockDbError | null) => {
      const c = createChain({ data, error: error ?? null });
      mock.from.mockReturnValueOnce(c);
      return c;
    },
    _onRpc: (data: unknown, error?: MockDbError | null) => {
      mock.rpc.mockReturnValueOnce(
        Promise.resolve({ data, error: error ?? null }),
      );
    },
  };
  mock.from.mockImplementation(() => createChain({ data: null, error: null }));
  mock.rpc.mockImplementation(() =>
    Promise.resolve({ data: null, error: null }),
  );
  return mock;
}

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
      ],
    }).compile();
    service = module.get<RecommendationsService>(RecommendationsService);
  });

  describe('today', () => {
    it('llama al RPC con el user_id correcto del request', async () => {
      supabase._onRpc([]); // RPC returns no recommendations
      // No places hydration call expected when RPC returns []

      await service.today('user-abc-123', {});

      expect(supabase.rpc).toHaveBeenCalledWith(
        'compute_recommendations_for',
        expect.objectContaining({ p_user_id: 'user-abc-123' }),
      );
    });

    it('pasa lat/lng cuando se proveen', async () => {
      supabase._onRpc([]);

      await service.today('user-1', { lat: 10.99, lng: -74.79 });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'compute_recommendations_for',
        expect.objectContaining({
          p_user_id: 'user-1',
          p_user_lat: 10.99,
          p_user_lng: -74.79,
        }),
      );
    });

    it('pasa null cuando no se proveen lat/lng', async () => {
      supabase._onRpc([]);

      await service.today('user-1', {});

      expect(supabase.rpc).toHaveBeenCalledWith(
        'compute_recommendations_for',
        expect.objectContaining({
          p_user_lat: null,
          p_user_lng: null,
        }),
      );
    });

    it('retorna array vacio si RPC retorna []', async () => {
      supabase._onRpc([]);

      const result = await service.today('user-1', {});

      expect(result.items).toEqual([]);
      expect(result.generated_at).toBeDefined();
    });

    it('retorna array vacio si RPC retorna null', async () => {
      supabase._onRpc(null);

      const result = await service.today('user-1', {});

      expect(result.items).toEqual([]);
    });

    it('respeta limit cuando se provee', async () => {
      supabase._onRpc([]);

      await service.today('user-1', { limit: 5 });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'compute_recommendations_for',
        expect.objectContaining({ p_limit: 5 }),
      );
    });

    it('aplica default de 10 cuando limit no se provee', async () => {
      supabase._onRpc([]);

      await service.today('user-1', {});

      expect(supabase.rpc).toHaveBeenCalledWith(
        'compute_recommendations_for',
        expect.objectContaining({ p_limit: 10 }),
      );
    });

    it('hace clamp del limit a maximo 20', async () => {
      supabase._onRpc([]);

      await service.today('user-1', { limit: 999 });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'compute_recommendations_for',
        expect.objectContaining({ p_limit: 20 }),
      );
    });

    it('hidrata items con datos de places y formatea reason no nula', async () => {
      supabase._onRpc([
        { place_id: 'p1', score: 0.85, reason: 'Cerca de ti · Top ranking' },
        { place_id: 'p2', score: 0.72, reason: 'Recomendado para ti' },
      ]);
      // Places hydration
      supabase._on([
        {
          id: 'p1',
          name: 'La Trattoria',
          slug: 'la-trattoria',
          description: 'Italiano',
          address: 'Cra 53',
          latitude: 10.99,
          longitude: -74.79,
          price_range: 2,
          average_rating: 4.5,
          total_reviews: 100,
          tags: ['pareja'],
          category_id: 'c1',
          categories: {
            id: 'c1',
            name: 'Restaurantes',
            slug: 'restaurantes',
            icon: 'utensils',
          },
          place_photos: [{ url: 'https://photo/p1.jpg', is_cover: true }],
        },
        {
          id: 'p2',
          name: 'El Muelle',
          slug: 'el-muelle',
          description: null,
          address: null,
          latitude: 10.98,
          longitude: -74.8,
          price_range: 3,
          average_rating: 4.0,
          total_reviews: 50,
          tags: [],
          category_id: 'c1',
          categories: {
            id: 'c1',
            name: 'Restaurantes',
            slug: 'restaurantes',
            icon: 'utensils',
          },
          place_photos: [],
        },
      ]);

      const result = await service.today('user-1', { lat: 10.99, lng: -74.79 });

      expect(result.items).toHaveLength(2);

      const first = result.items[0];
      expect(first.place.id).toBe('p1');
      expect(first.place.name).toBe('La Trattoria');
      expect(first.place.cover_photo_url).toBe('https://photo/p1.jpg');
      expect(first.score).toBe(0.85);
      expect(first.reason).toBe('Cerca de ti · Top ranking');
      expect(typeof first.reason).toBe('string');
      expect(first.reason.length).toBeGreaterThan(0);

      const second = result.items[1];
      expect(second.place.id).toBe('p2');
      expect(second.place.cover_photo_url).toBeNull();
      expect(second.reason).toBe('Recomendado para ti');
    });

    it('preserva el orden de las recomendaciones que retorna el RPC', async () => {
      // RPC ya ordena por score DESC; el service no debe reordenar.
      supabase._onRpc([
        { place_id: 'p2', score: 0.9, reason: 'Top ranking' },
        { place_id: 'p1', score: 0.5, reason: 'Recomendado para ti' },
      ]);
      // Supabase .in() puede devolver en otro orden — el service debe respetar
      // el orden del RPC.
      supabase._on([
        {
          id: 'p1',
          name: 'A',
          slug: 'a',
          description: null,
          address: null,
          latitude: null,
          longitude: null,
          price_range: null,
          average_rating: 3.0,
          total_reviews: 5,
          tags: [],
          category_id: 'c1',
          categories: null,
          place_photos: [],
        },
        {
          id: 'p2',
          name: 'B',
          slug: 'b',
          description: null,
          address: null,
          latitude: null,
          longitude: null,
          price_range: null,
          average_rating: 4.5,
          total_reviews: 50,
          tags: [],
          category_id: 'c1',
          categories: null,
          place_photos: [],
        },
      ]);

      const result = await service.today('user-1', {});

      expect(result.items[0].place.id).toBe('p2');
      expect(result.items[1].place.id).toBe('p1');
    });

    it('reason nunca es null aunque el RPC devuelva un valor vacio', async () => {
      // Defensa: si el RPC alguna vez devuelve reason vacio, el service lo
      // reemplaza con el fallback en español.
      supabase._onRpc([{ place_id: 'p1', score: 0.5, reason: '' }]);
      supabase._on([
        {
          id: 'p1',
          name: 'X',
          slug: 'x',
          description: null,
          address: null,
          latitude: null,
          longitude: null,
          price_range: null,
          average_rating: 3.0,
          total_reviews: 5,
          tags: [],
          category_id: 'c1',
          categories: null,
          place_photos: [],
        },
      ]);

      const result = await service.today('user-1', {});

      expect(result.items[0].reason).toBeTruthy();
      expect(result.items[0].reason).toBe('Recomendado para ti');
    });
  });
});
