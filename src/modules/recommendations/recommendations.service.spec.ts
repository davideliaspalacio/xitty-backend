import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsService } from './recommendations.service';

// ── Supabase mock ─────────────────────────────────────────────────────────
// Chain builder for `.from(...).select(...).in(...)...` queries.
function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete',
    'eq', 'in', 'order', 'limit', 'single', 'maybeSingle',
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
  mock._onRpc = (data: any, error?: any) => {
    mock.rpc.mockReturnValueOnce(
      Promise.resolve({ data, error: error || null }),
    );
  };
  mock.from.mockImplementation(() =>
    createChain({ data: null, error: null }),
  );
  mock.rpc.mockImplementation(() =>
    Promise.resolve({ data: null, error: null }),
  );
  return mock;
}

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
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
          categories: { id: 'c1', name: 'Restaurantes', slug: 'restaurantes', icon: 'utensils' },
          place_photos: [{ url: 'https://photo/p1.jpg', is_cover: true }],
        },
        {
          id: 'p2',
          name: 'El Muelle',
          slug: 'el-muelle',
          description: null,
          address: null,
          latitude: 10.98,
          longitude: -74.80,
          price_range: 3,
          average_rating: 4.0,
          total_reviews: 50,
          tags: [],
          category_id: 'c1',
          categories: { id: 'c1', name: 'Restaurantes', slug: 'restaurantes', icon: 'utensils' },
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
          id: 'p1', name: 'A', slug: 'a', description: null, address: null,
          latitude: null, longitude: null, price_range: null,
          average_rating: 3.0, total_reviews: 5, tags: [], category_id: 'c1',
          categories: null, place_photos: [],
        },
        {
          id: 'p2', name: 'B', slug: 'b', description: null, address: null,
          latitude: null, longitude: null, price_range: null,
          average_rating: 4.5, total_reviews: 50, tags: [], category_id: 'c1',
          categories: null, place_photos: [],
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
          id: 'p1', name: 'X', slug: 'x', description: null, address: null,
          latitude: null, longitude: null, price_range: null,
          average_rating: 3.0, total_reviews: 5, tags: [], category_id: 'c1',
          categories: null, place_photos: [],
        },
      ]);

      const result = await service.today('user-1', {});

      expect(result.items[0].reason).toBeTruthy();
      expect(result.items[0].reason).toBe('Recomendado para ti');
    });
  });
});
