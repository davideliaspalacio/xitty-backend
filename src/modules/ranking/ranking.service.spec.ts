import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RankingService } from './ranking.service';

function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from',
    'select',
    'update',
    'eq',
    'in',
    'is',
    'lt',
    'order',
    'limit',
    'single',
    'maybeSingle',
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
  mock.from.mockImplementation(() => createChain({ data: null, error: null }));
  mock.rpc.mockImplementation(() =>
    Promise.resolve({ data: null, error: null }),
  );
  return mock;
}

describe('RankingService', () => {
  let service: RankingService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankingService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get<RankingService>(RankingService);
  });

  // ── Ranking global ──────────────────────────────────────────────

  describe('getGlobalRanking', () => {
    it('devuelve los items con position_change calculado', async () => {
      // 1) place_rankings view
      const rankingChain = supabase._on([
        {
          place_id: 'p1',
          category_id: 'c1',
          global_position: 1,
          category_position: 4,
          position: 1,
          score: 0.85,
          views_30d: 500,
          conversions_30d: 50,
        },
        {
          place_id: 'p2',
          category_id: 'c1',
          global_position: 2,
          category_position: 5,
          position: 2,
          score: 0.7,
          views_30d: 200,
          conversions_30d: 20,
        },
      ]);
      // 2) places hydration
      supabase._on([
        {
          id: 'p1',
          name: 'Top Place',
          slug: 'top-place',
          description: null,
          address: null,
          category_id: 'c1',
          average_rating: 4.5,
          total_reviews: 100,
          is_sponsored: false,
          sponsored_until: null,
          place_photos: [
            { url: 'https://img/p1.jpg', is_cover: true, display_order: 0 },
          ],
        },
        {
          id: 'p2',
          name: 'Second',
          slug: 'second',
          description: null,
          address: null,
          category_id: 'c1',
          average_rating: 4.0,
          total_reviews: 80,
          is_sponsored: false,
          sponsored_until: null,
          place_photos: [],
        },
      ]);
      // 3) ranking_snapshots — p1 was at position 3 yesterday (climbed +2),
      //    p2 has no prior snapshot.
      const snapshotChain = supabase._on([
        { place_id: 'p1', position: 3, snapshot_at: '2026-04-25T08:00:00Z' },
      ]);

      const result = await service.getGlobalRanking(10);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].place.id).toBe('p1');
      expect(result.data[0].position).toBe(1);
      expect(result.data[0].previous_position).toBe(3);
      expect(result.data[0].position_change).toBe(2);
      expect(result.data[0].place.cover_photo_url).toBe('https://img/p1.jpg');
      expect(result.data[1].previous_position).toBeNull();
      expect(result.data[1].position_change).toBeNull();
      expect(rankingChain.order).toHaveBeenCalledWith('global_position', {
        ascending: true,
      });
      expect(snapshotChain.eq).toHaveBeenCalledWith('scope', 'global');
      expect(snapshotChain.is).toHaveBeenCalledWith('category_id', null);
    });

    it('promueve items patrocinados al inicio del ranking', async () => {
      const future = new Date(Date.now() + 86400_000).toISOString();
      supabase._on([
        {
          place_id: 'p1',
          category_id: 'c1',
          global_position: 1,
          category_position: 1,
          position: 1,
          score: 0.9,
          views_30d: 0,
          conversions_30d: 0,
        },
        {
          place_id: 'p2',
          category_id: 'c1',
          global_position: 2,
          category_position: 2,
          position: 2,
          score: 0.4,
          views_30d: 0,
          conversions_30d: 0,
        },
      ]);
      supabase._on([
        {
          id: 'p1',
          name: 'Organic leader',
          slug: 'p1',
          description: null,
          address: null,
          category_id: 'c1',
          average_rating: 4.8,
          total_reviews: 200,
          is_sponsored: false,
          sponsored_until: null,
          place_photos: [],
        },
        {
          id: 'p2',
          name: 'Sponsored',
          slug: 'p2',
          description: null,
          address: null,
          category_id: 'c1',
          average_rating: 3.0,
          total_reviews: 5,
          is_sponsored: true,
          sponsored_until: future,
          sponsorship_priority: 10,
          place_photos: [],
        },
      ]);
      supabase._on([]);

      const result = await service.getGlobalRanking(10);

      expect(result.data[0].place.id).toBe('p2');
      expect(result.data[0].is_sponsored).toBe(true);
      expect(result.data[0].sponsored_label).toBe('Patrocinado');
      expect(result.data[1].place.id).toBe('p1');
      expect(result.data[1].is_sponsored).toBe(false);
    });

    it('limita patrocinados a 3 slots ordenados por prioridad', async () => {
      const future = new Date(Date.now() + 86400_000).toISOString();
      supabase._on([
        {
          place_id: 'p1',
          category_id: 'c1',
          global_position: 1,
          category_position: 1,
          position: 1,
          score: 0.95,
          views_30d: 0,
          conversions_30d: 0,
        },
        {
          place_id: 'p2',
          category_id: 'c1',
          global_position: 2,
          category_position: 2,
          position: 2,
          score: 0.9,
          views_30d: 0,
          conversions_30d: 0,
        },
        {
          place_id: 'p3',
          category_id: 'c1',
          global_position: 3,
          category_position: 3,
          position: 3,
          score: 0.8,
          views_30d: 0,
          conversions_30d: 0,
        },
        {
          place_id: 'p4',
          category_id: 'c1',
          global_position: 4,
          category_position: 4,
          position: 4,
          score: 0.7,
          views_30d: 0,
          conversions_30d: 0,
        },
        {
          place_id: 'p5',
          category_id: 'c1',
          global_position: 5,
          category_position: 5,
          position: 5,
          score: 0.6,
          views_30d: 0,
          conversions_30d: 0,
        },
      ]);
      supabase._on([
        {
          id: 'p1',
          name: 'Organic leader sponsored overflow',
          slug: 'p1',
          description: null,
          address: null,
          category_id: 'c1',
          average_rating: 5,
          total_reviews: 100,
          is_sponsored: true,
          sponsored_until: future,
          sponsorship_priority: 1,
          place_photos: [],
        },
        {
          id: 'p2',
          name: 'Priority 80',
          slug: 'p2',
          description: null,
          address: null,
          category_id: 'c1',
          average_rating: 4,
          total_reviews: 80,
          is_sponsored: true,
          sponsored_until: future,
          sponsorship_priority: 80,
          place_photos: [],
        },
        {
          id: 'p3',
          name: 'Priority 40',
          slug: 'p3',
          description: null,
          address: null,
          category_id: 'c1',
          average_rating: 4,
          total_reviews: 80,
          is_sponsored: true,
          sponsored_until: future,
          sponsorship_priority: 40,
          place_photos: [],
        },
        {
          id: 'p4',
          name: 'Priority 60',
          slug: 'p4',
          description: null,
          address: null,
          category_id: 'c1',
          average_rating: 4,
          total_reviews: 80,
          is_sponsored: true,
          sponsored_until: future,
          sponsorship_priority: 60,
          place_photos: [],
        },
        {
          id: 'p5',
          name: 'Organic',
          slug: 'p5',
          description: null,
          address: null,
          category_id: 'c1',
          average_rating: 3,
          total_reviews: 20,
          is_sponsored: false,
          sponsored_until: null,
          sponsorship_priority: 0,
          place_photos: [],
        },
      ]);
      supabase._on([]);

      const result = await service.getGlobalRanking(5);

      expect(result.data.slice(0, 3).map((item) => item.place.id)).toEqual([
        'p2',
        'p4',
        'p3',
      ]);
      expect(result.data.slice(0, 3).every((item) => item.is_sponsored)).toBe(
        true,
      );
      const overflow = result.data.find((item) => item.place.id === 'p1');
      expect(overflow?.is_sponsored).toBe(false);
      expect(overflow?.position).toBe(1);
    });

    it('ignora sponsored expirados (sponsored_until en el pasado)', async () => {
      const past = new Date(Date.now() - 86400_000).toISOString();
      supabase._on([
        {
          place_id: 'p1',
          category_id: 'c1',
          global_position: 1,
          category_position: 1,
          position: 1,
          score: 0.5,
          views_30d: 0,
          conversions_30d: 0,
        },
      ]);
      supabase._on([
        {
          id: 'p1',
          name: 'Expired sponsored',
          slug: 'p1',
          description: null,
          address: null,
          category_id: 'c1',
          average_rating: 3.0,
          total_reviews: 1,
          is_sponsored: true,
          sponsored_until: past,
          sponsorship_priority: 100,
          place_photos: [],
        },
      ]);
      supabase._on([]);

      const result = await service.getGlobalRanking(5);
      expect(result.data[0].is_sponsored).toBe(false);
      expect(result.data[0].sponsored_label).toBeNull();
    });

    it('devuelve array vacio cuando no hay rankings', async () => {
      supabase._on([]);
      const result = await service.getGlobalRanking(10);
      expect(result.data).toEqual([]);
    });
  });

  // ── Ranking por categoria ───────────────────────────────────────

  describe('getCategoryRanking', () => {
    it('devuelve items filtrados por categoryId', async () => {
      const rankingChain = supabase._on([
        {
          place_id: 'p1',
          category_id: 'cat-1',
          global_position: 8,
          category_position: 1,
          position: 8,
          score: 0.8,
          views_30d: 100,
          conversions_30d: 10,
        },
      ]);
      supabase._on([
        {
          id: 'p1',
          name: 'Pizza Place',
          slug: 'pizza',
          description: null,
          address: null,
          category_id: 'cat-1',
          average_rating: 4.2,
          total_reviews: 30,
          is_sponsored: false,
          sponsored_until: null,
          place_photos: [],
        },
      ]);
      const snapshotChain = supabase._on([]);

      const result = await service.getCategoryRanking('cat-1', 20);
      expect(result.category_id).toBe('cat-1');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].position).toBe(1);
      expect(rankingChain.order).toHaveBeenCalledWith('category_position', {
        ascending: true,
      });
      expect(snapshotChain.eq).toHaveBeenCalledWith('scope', 'category');
      expect(snapshotChain.eq).toHaveBeenCalledWith('category_id', 'cat-1');
    });
  });

  // ── Refresh manual ──────────────────────────────────────────────

  describe('refresh', () => {
    it('invoca el RPC refresh_place_rankings', async () => {
      supabase._onRpc(null);
      const result = await service.refresh();
      expect(supabase.rpc).toHaveBeenCalledWith('refresh_place_rankings');
      expect(result.refreshed_at).toBeDefined();
    });
  });

  // ── Sponsorship ─────────────────────────────────────────────────

  describe('activateSponsorship', () => {
    it('admin puede activar patrocinio', async () => {
      const future = new Date(Date.now() + 30 * 86400_000).toISOString();
      supabase._on({
        id: 'place-1',
        is_sponsored: false,
        sponsored_at: null,
        sponsored_until: null,
      });
      supabase._on({
        id: 'place-1',
        is_sponsored: true,
        sponsored_at: '2026-04-26T00:00:00Z',
        sponsored_until: future,
        sponsorship_priority: 50,
      });

      const result = await service.activateSponsorship(
        'place-1',
        30,
        'admin',
        50,
      );
      expect(result.is_sponsored).toBe(true);
      expect(result.place_id).toBe('place-1');
      expect(result.sponsorship_priority).toBe(50);
    });

    it('extiende patrocinio vigente desde sponsored_until actual', async () => {
      supabase._on({
        id: 'place-1',
        is_sponsored: true,
        sponsored_at: '2026-07-01T00:00:00.000Z',
        sponsored_until: '2099-07-10T00:00:00.000Z',
      });
      const updateChain = supabase._on({
        id: 'place-1',
        is_sponsored: true,
        sponsored_at: '2026-07-01T00:00:00.000Z',
        sponsored_until: '2099-07-17T00:00:00.000Z',
        sponsorship_priority: 25,
      });

      await service.activateSponsorship('place-1', 7, 'admin', 25);

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          sponsored_at: '2026-07-01T00:00:00.000Z',
          sponsored_until: '2099-07-17T00:00:00.000Z',
          sponsorship_priority: 25,
        }),
      );
    });

    it('rechaza a quien no es admin', async () => {
      await expect(
        service.activateSponsorship('place-1', 30, 'business'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza 404 si el place no existe', async () => {
      supabase._on(null, { code: 'PGRST116' });
      await expect(
        service.activateSponsorship('missing', 7, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateSponsorship', () => {
    it('admin puede desactivar patrocinio', async () => {
      supabase._on({
        id: 'place-1',
        is_sponsored: false,
        sponsored_at: '2026-04-01T00:00:00Z',
        sponsored_until: null,
        sponsorship_priority: 0,
      });

      const result = await service.deactivateSponsorship('place-1', 'admin');
      expect(result.is_sponsored).toBe(false);
      expect(result.sponsored_until).toBeNull();
      expect(result.sponsorship_priority).toBe(0);
    });

    it('rechaza a quien no es admin', async () => {
      await expect(
        service.deactivateSponsorship('place-1', 'business'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
