import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { SupabaseClient } from '@supabase/supabase-js';

import { PromotionsService } from './promotions.service';
import type { CreatePromotionDto } from './dto/create-promotion.dto';

interface MockDbError {
  message: string;
  code?: string;
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
  order: ChainMethod;
  range: ChainMethod;
  single: ChainMethod;
  maybeSingle: ChainMethod;
}

interface MockSupabase {
  from: ChainMethod;
  _on: (data: unknown, error?: MockDbError | null, count?: number) => MockChain;
}

interface PromotionTestRow {
  id: string;
  place_id: string;
  title: string;
  description: string | null;
  discount_percentage: number | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  is_hero?: boolean;
  hero_priority?: number | null;
  hero_image_url?: string | null;
  places?: { id: string; name: string; slug: string | null };
}

const validDto: CreatePromotionDto = {
  title: 'Promo X',
  starts_at: '2026-04-20T00:00:00Z',
  ends_at: '2026-04-30T00:00:00Z',
};

function createChain(result: MockDbResult): MockChain {
  const chain = {} as MockChain;
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
    _on: (data: unknown, error?: MockDbError | null, count?: number) => {
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

function promoRow(overrides: Partial<PromotionTestRow> = {}): PromotionTestRow {
  return {
    id: 'promo-1',
    place_id: 'place-1',
    title: 'Promo X',
    description: null,
    discount_percentage: null,
    starts_at: '2026-04-20T00:00:00Z',
    ends_at: '2026-04-30T00:00:00Z',
    is_active: true,
    created_at: 't',
    updated_at: 't',
    ...overrides,
  };
}

function firstArg<T>(method: ChainMethod): T {
  return method.mock.calls[0]?.[0] as T;
}

describe('PromotionsService', () => {
  let service: PromotionsService;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
      ],
    }).compile();
    service = module.get<PromotionsService>(PromotionsService);
  });

  describe('findActiveByPlace', () => {
    it('devuelve promociones activas ordenadas', async () => {
      supabase._on([
        promoRow({ id: 'p1', title: '2x1 pizzas' }),
        promoRow({ id: 'p2', title: 'Happy hour' }),
      ]);

      const result = await service.findActiveByPlace('place-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('findAllActive', () => {
    it('devuelve promos paginadas con info del lugar', async () => {
      supabase._on(
        [
          promoRow({
            id: 'p1',
            title: '2x1',
            places: { id: 'place-1', name: 'Trattoria', slug: 'trattoria' },
          }),
        ],
        null,
        1,
      );

      const result = await service.findAllActive(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findManageByPlace', () => {
    it('devuelve todas las promociones del lugar para el owner', async () => {
      supabase._on({ owner_id: 'owner-1' });
      supabase._on([
        promoRow({ id: 'active-promo', is_active: true }),
        promoRow({ id: 'expired-promo', is_active: true }),
        promoRow({ id: 'disabled-promo', is_active: false }),
      ]);

      const result = await service.findManageByPlace(
        'place-1',
        'owner-1',
        'business',
      );

      expect(result).toHaveLength(3);
      expect(supabase.from).toHaveBeenCalledWith('promotions');
    });

    it('rechaza gestion si no es owner ni admin', async () => {
      supabase._on({ owner_id: 'otro-owner' });

      await expect(
        service.findManageByPlace('place-1', 'user-1', 'business'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('owner del place puede crear promocion', async () => {
      supabase._on({ owner_id: 'owner-1' });
      supabase._on(promoRow({ id: 'new-promo', ...validDto }));

      const result = await service.create(
        'place-1',
        'owner-1',
        'business',
        validDto,
      );

      expect(result.id).toBe('new-promo');
    });

    it('admin puede crear promocion en cualquier place', async () => {
      supabase._on(promoRow({ id: 'new-promo', ...validDto }));

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

    it('normaliza fechas date-only como dia completo en America/Bogota', async () => {
      supabase._on({ owner_id: 'owner-1' });
      const insertChain = supabase._on(
        promoRow({ id: 'new-promo', title: 'Promo de un dia' }),
      );

      await service.create('place-1', 'owner-1', 'business', {
        title: 'Promo de un dia',
        starts_at: '2026-07-09',
        ends_at: '2026-07-09',
      });

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          starts_at: '2026-07-09T05:00:00.000Z',
          ends_at: '2026-07-10T04:59:59.999Z',
        }),
      );
    });
  });

  describe('remove', () => {
    it('owner puede eliminar su promocion', async () => {
      supabase._on({ owner_id: 'owner-1' });
      supabase._on(null);

      await expect(
        service.remove('place-1', 'promo-1', 'owner-1', 'business'),
      ).resolves.toBeUndefined();
    });
  });

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

    it('rechaza update parcial cuando deja ends_at antes de starts_at existente', async () => {
      supabase._on({ owner_id: 'owner-1' });
      supabase._on({
        id: 'promo-1',
        starts_at: '2026-07-10T05:00:00.000Z',
        ends_at: '2026-07-12T04:59:59.999Z',
      });

      await expect(
        service.update('place-1', 'promo-1', 'owner-1', 'business', {
          ends_at: '2026-07-09',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite editar una promocion vencida desde gestion', async () => {
      supabase._on({ owner_id: 'owner-1' });
      supabase._on({
        id: 'promo-1',
        starts_at: '2026-01-01T05:00:00.000Z',
        ends_at: '2026-01-02T04:59:59.999Z',
      });
      const updateChain = supabase._on(
        promoRow({ id: 'promo-1', title: 'Promo renovada' }),
      );

      const result = await service.update(
        'place-1',
        'promo-1',
        'owner-1',
        'business',
        { title: 'Promo renovada' },
      );

      expect(result.title).toBe('Promo renovada');
      expect(updateChain.update).toHaveBeenCalledWith({
        title: 'Promo renovada',
      });
    });

    it('normaliza fechas date-only en update', async () => {
      supabase._on({ owner_id: 'owner-1' });
      supabase._on({
        id: 'promo-1',
        starts_at: '2026-07-01T05:00:00.000Z',
        ends_at: '2026-07-02T04:59:59.999Z',
      });
      const updateChain = supabase._on(promoRow({ id: 'promo-1' }));

      await service.update('place-1', 'promo-1', 'owner-1', 'business', {
        starts_at: '2026-07-09',
        ends_at: '2026-07-09',
      });

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          starts_at: '2026-07-09T05:00:00.000Z',
          ends_at: '2026-07-10T04:59:59.999Z',
        }),
      );
    });
  });

  describe('getHero', () => {
    it('lee de active_hero_promotions ordenado por hero_priority desc', async () => {
      const chain = supabase._on([
        promoRow({
          id: 'h1',
          place_id: 'place-1',
          title: 'Hero 1',
          description: 'Top hero',
          discount_percentage: 30,
          is_hero: true,
          hero_priority: 90,
          hero_image_url: 'https://images.unsplash.com/photo-aaa',
          places: { id: 'place-1', name: 'Trattoria', slug: 'trattoria' },
        }),
        promoRow({
          id: 'h2',
          place_id: 'place-2',
          title: 'Hero 2',
          description: null,
          discount_percentage: null,
          is_hero: true,
          hero_priority: 50,
          hero_image_url: 'https://images.unsplash.com/photo-bbb',
          places: { id: 'place-2', name: 'Bar Caribe', slug: 'bar-caribe' },
        }),
      ]);

      const result = await service.getHero();

      expect(result).toHaveLength(2);
      expect(supabase.from).toHaveBeenCalledWith('active_hero_promotions');
      expect(chain.order).toHaveBeenCalledWith('hero_priority', {
        ascending: false,
      });
      expect(result[0].id).toBe('h1');
      expect(result[0].hero_image_url).toContain('unsplash');
      expect(result[0].places?.slug).toBe('trattoria');
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
      supabase._on({ id: 'promo-1', place_id: 'place-1' });
      const insertChain = supabase._on({ id: 'int-1' });

      await service.recordImpression(
        'promo-1',
        'user-1',
        { anonymous_session_id: 'session-abc-123' },
        { userAgent: 'Mozilla/5.0' },
      );

      const inserted = firstArg<Record<string, unknown>>(insertChain.insert);
      expect(inserted.interaction_type).toBe('ad_impression');
      expect(inserted.promo_id).toBe('promo-1');
      expect(inserted.place_id).toBe('place-1');
      expect(inserted.user_id).toBe('user-1');
      expect(String(inserted.dedup_key)).toContain('user:user-1');
      expect(typeof inserted.anonymous_session_hash).toBe('string');
      expect(JSON.stringify(inserted)).not.toContain('session-abc-123');
    });

    it('acepta user_id null (impresion anonima)', async () => {
      supabase._on({ id: 'promo-1', place_id: 'place-1' });
      const insertChain = supabase._on({ id: 'int-2' });

      await service.recordImpression('promo-1', undefined, {
        anonymous_session_id: 'anon-session-xyz',
      });

      const inserted = firstArg<Record<string, unknown>>(insertChain.insert);
      expect(inserted.interaction_type).toBe('ad_impression');
      expect(inserted.promo_id).toBe('promo-1');
      expect(inserted.place_id).toBe('place-1');
      expect(inserted.user_id).toBeNull();
      expect(typeof inserted.anonymous_session_hash).toBe('string');
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
