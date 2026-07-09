import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PromotionsService } from './promotions.service';

function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from',
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'order',
    'range',
    'single',
    'maybeSingle',
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

describe('PromotionsService', () => {
  let service: PromotionsService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get<PromotionsService>(PromotionsService);
  });

  // ── Listar promociones activas de un place ──────────────────────

  describe('findActiveByPlace', () => {
    it('devuelve promociones activas ordenadas', async () => {
      supabase._on([
        { id: 'p1', place_id: 'place-1', title: '2x1 pizzas' },
        { id: 'p2', place_id: 'place-1', title: 'Happy hour' },
      ]);

      const result = await service.findActiveByPlace('place-1');
      expect(result).toHaveLength(2);
    });
  });

  // ── Listar todas las promociones activas (directorio) ──────────

  describe('findAllActive', () => {
    it('devuelve promos paginadas con info del lugar', async () => {
      supabase._on(
        [
          {
            id: 'p1',
            title: '2x1',
            places: { id: 'place-1', name: 'Trattoria', slug: 'trattoria' },
          },
        ],
        null,
        1,
      );

      const result = await service.findAllActive(1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ── Crear promocion ─────────────────────────────────────────────

  describe('create', () => {
    const validDto = {
      title: 'Promo X',
      starts_at: '2026-04-20T00:00:00Z',
      ends_at: '2026-04-30T00:00:00Z',
    };

    it('owner del place puede crear promocion', async () => {
      supabase._on({ owner_id: 'owner-1' }); // ownership check
      supabase._on({ id: 'new-promo', ...validDto });

      const result = await service.create(
        'place-1',
        'owner-1',
        'business',
        validDto,
      );
      expect(result.id).toBe('new-promo');
    });

    it('admin puede crear promocion en cualquier place', async () => {
      supabase._on({ id: 'new-promo', ...validDto });
      const result = await service.create(
        'place-1',
        'admin-1',
        'admin',
        validDto,
      );
      expect(result.id).toBe('new-promo');
    });

    it('rechaza si no es owner ni admin', async () => {
      supabase._on({ owner_id: 'otro-owner' });
      await expect(
        service.create('place-1', 'user-1', 'business', validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza si ends_at <= starts_at', async () => {
      supabase._on({ owner_id: 'owner-1' });
      await expect(
        service.create('place-1', 'owner-1', 'business', {
          ...validDto,
          starts_at: '2026-04-20T00:00:00Z',
          ends_at: '2026-04-19T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Eliminar promocion ──────────────────────────────────────────

  describe('remove', () => {
    it('owner puede eliminar su promocion', async () => {
      supabase._on({ owner_id: 'owner-1' });
      supabase._on(null);
      await expect(
        service.remove('place-1', 'promo-1', 'owner-1', 'business'),
      ).resolves.toBeUndefined();
    });
  });

  // ── Actualizar promocion ────────────────────────────────────────

  describe('update', () => {
    it('requiere al menos un campo', async () => {
      supabase._on({ owner_id: 'owner-1' });
      await expect(
        service.update('place-1', 'promo-1', 'owner-1', 'business', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza 404 si no existe', async () => {
      supabase._on({ owner_id: 'owner-1' });
      supabase._on(null, null);
      await expect(
        service.update('place-1', 'promo-1', 'owner-1', 'business', {
          title: 'X',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Hero ads ────────────────────────────────────────────────────

  describe('getHero', () => {
    it('lee de active_hero_promotions ordenado por hero_priority desc', async () => {
      const chain = supabase._on([
        {
          id: 'h1',
          place_id: 'place-1',
          title: 'Hero 1',
          description: 'Top hero',
          discount_percentage: 30,
          starts_at: '2026-06-01T00:00:00Z',
          ends_at: '2026-12-01T00:00:00Z',
          is_active: true,
          is_hero: true,
          hero_priority: 90,
          hero_image_url: 'https://images.unsplash.com/photo-aaa',
          places: { id: 'place-1', name: 'Trattoria', slug: 'trattoria' },
        },
        {
          id: 'h2',
          place_id: 'place-2',
          title: 'Hero 2',
          description: null,
          discount_percentage: null,
          starts_at: '2026-06-01T00:00:00Z',
          ends_at: '2026-12-01T00:00:00Z',
          is_active: true,
          is_hero: true,
          hero_priority: 50,
          hero_image_url: 'https://images.unsplash.com/photo-bbb',
          places: { id: 'place-2', name: 'Bar Caribe', slug: 'bar-caribe' },
        },
      ]);

      const result = await service.getHero();

      expect(result).toHaveLength(2);
      expect(supabase.from).toHaveBeenCalledWith('active_hero_promotions');
      // first order should be by hero_priority desc
      expect(chain.order).toHaveBeenCalledWith('hero_priority', {
        ascending: false,
      });
      const first: any = result[0];
      expect(first.id).toBe('h1');
      expect(first.hero_image_url).toContain('unsplash');
      expect(first.places.slug).toBe('trattoria');
    });

    it('retorna array vacio si no hay hero promos', async () => {
      supabase._on(null);

      const result = await service.getHero();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('lanza BadRequest si supabase falla', async () => {
      supabase._on(null, { message: 'boom' });
      await expect(service.getHero()).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordImpression', () => {
    it('inserta interaction_type ad_impression con promo_id', async () => {
      // 1: promo lookup (place_id resolution)
      supabase._on({ id: 'promo-1', place_id: 'place-1' });
      // 2: insert
      const insertChain = supabase._on({ id: 'int-1' });

      await service.recordImpression(
        'promo-1',
        'user-1',
        { anonymous_session_id: 'session-abc-123' },
        { userAgent: 'Mozilla/5.0' },
      );

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          interaction_type: 'ad_impression',
          promo_id: 'promo-1',
          place_id: 'place-1',
          user_id: 'user-1',
          dedup_key: expect.stringContaining('user:user-1'),
          anonymous_session_hash: expect.any(String),
        }),
      );
      expect(JSON.stringify(insertChain.insert.mock.calls[0][0])).not.toContain(
        'session-abc-123',
      );
    });

    it('acepta user_id null (impresion anonima)', async () => {
      supabase._on({ id: 'promo-1', place_id: 'place-1' });
      const insertChain = supabase._on({ id: 'int-2' });

      await service.recordImpression('promo-1', undefined, {
        anonymous_session_id: 'anon-session-xyz',
      });

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          interaction_type: 'ad_impression',
          promo_id: 'promo-1',
          place_id: 'place-1',
          user_id: null,
          anonymous_session_hash: expect.any(String),
        }),
      );
    });

    it('lanza NotFound si la promo no existe', async () => {
      supabase._on(null);
      await expect(service.recordImpression('promo-nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('ignora impresiones de bots sin tocar la base', async () => {
      await expect(
        service.recordImpression(
          'promo-1',
          undefined,
          { anonymous_session_id: 'anon-session-xyz' },
          { userAgent: 'facebookexternalhit/1.1' },
        ),
      ).resolves.toEqual({ success: true });

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('trata el unique de dedup_key como exito', async () => {
      supabase._on({ id: 'promo-1', place_id: 'place-1' });
      supabase._on(null, {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "microsite_interactions_dedup_key_uidx"',
      });

      await expect(
        service.recordImpression('promo-1', undefined, {
          anonymous_session_id: 'anon-session-xyz',
        }),
      ).resolves.toEqual({ success: true });
    });
  });
});
