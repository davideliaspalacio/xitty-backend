import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PromotionsService } from './promotions.service';

function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete',
    'eq', 'order', 'range', 'single', 'maybeSingle',
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
            id: 'p1', title: '2x1', places: { id: 'place-1', name: 'Trattoria', slug: 'trattoria' },
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

      const result = await service.create('place-1', 'owner-1', 'business', validDto);
      expect(result.id).toBe('new-promo');
    });

    it('admin puede crear promocion en cualquier place', async () => {
      supabase._on({ id: 'new-promo', ...validDto });
      const result = await service.create('place-1', 'admin-1', 'admin', validDto);
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
        service.update('place-1', 'promo-1', 'owner-1', 'business', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
