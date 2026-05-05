import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';

function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete',
    'eq', 'in', 'order', 'range', 'single', 'maybeSingle',
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

describe('ReservationsService', () => {
  let service: ReservationsService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get<ReservationsService>(ReservationsService);
  });

  // ── Crear reserva ──────────────────────────────────────────────

  describe('create', () => {
    const future = () => new Date(Date.now() + 7 * 86400_000).toISOString();

    it('crea reserva confirmada y calcula total_price_cop', async () => {
      supabase._on({ id: 'e1', price_cop: 80000, min_participants: 1, max_participants: 10, is_active: true });
      supabase._on({
        id: 's1', experience_id: 'e1', starts_at: future(),
        capacity: 8, seats_taken: 2, is_active: true,
      });
      supabase._on({
        id: 'r1', slot_id: 's1', experience_id: 'e1', user_id: 'u1',
        participants: 2, total_price_cop: 160000, status: 'confirmed',
        cancelled_at: null, created_at: 'now', updated_at: 'now',
        slot: { id: 's1', starts_at: future() },
        experience: { id: 'e1', title: 'X', slug: 'x', duration_minutes: 120 },
      });
      supabase._on({ url: 'https://img/cover.jpg' });

      const result = await service.create('e1', 'u1', { slot_id: 's1', participants: 2 });
      expect(result.id).toBe('r1');
      expect(result.total_price_cop).toBe(160000);
      expect(result.experience.cover_photo_url).toBe('https://img/cover.jpg');
    });

    it('rechaza si participants > max_participants', async () => {
      supabase._on({ id: 'e1', price_cop: 80000, min_participants: 1, max_participants: 4, is_active: true });
      await expect(
        service.create('e1', 'u1', { slot_id: 's1', participants: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si participants < min_participants', async () => {
      supabase._on({ id: 'e1', price_cop: 80000, min_participants: 2, max_participants: 10, is_active: true });
      await expect(
        service.create('e1', 'u1', { slot_id: 's1', participants: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza 404 si la experience no existe', async () => {
      supabase._on(null);
      await expect(
        service.create('missing', 'u1', { slot_id: 's1', participants: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza si slot pertenece a otra experience', async () => {
      supabase._on({ id: 'e1', price_cop: 80000, min_participants: 1, max_participants: 10, is_active: true });
      supabase._on({
        id: 's1', experience_id: 'OTHER', starts_at: future(),
        capacity: 8, seats_taken: 0, is_active: true,
      });
      await expect(
        service.create('e1', 'u1', { slot_id: 's1', participants: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza sobreventa antes del trigger', async () => {
      supabase._on({ id: 'e1', price_cop: 80000, min_participants: 1, max_participants: 10, is_active: true });
      supabase._on({
        id: 's1', experience_id: 'e1', starts_at: future(),
        capacity: 5, seats_taken: 4, is_active: true,
      });
      await expect(
        service.create('e1', 'u1', { slot_id: 's1', participants: 2 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Mis reservas ───────────────────────────────────────────────

  describe('findMine', () => {
    it('lista las reservas del usuario con paginacion', async () => {
      supabase._on(
        [
          {
            id: 'r1', slot_id: 's1', experience_id: 'e1', user_id: 'u1',
            participants: 2, total_price_cop: 160000, status: 'confirmed',
            cancelled_at: null, created_at: 'now', updated_at: 'now',
            slot: { id: 's1', starts_at: '2026-05-15T14:00:00Z' },
            experience: { id: 'e1', title: 'Tour', slug: 'tour', duration_minutes: 120 },
          },
        ],
        null,
        1,
      );
      supabase._on([{ experience_id: 'e1', url: 'https://img/cover.jpg' }]);

      const result = await service.findMine('u1', 1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].experience.cover_photo_url).toBe('https://img/cover.jpg');
    });
  });

  // ── Cancelacion ────────────────────────────────────────────────

  describe('cancel', () => {
    it('cancela si esta dentro de la ventana', async () => {
      const farFuture = new Date(Date.now() + 5 * 86400_000).toISOString();
      supabase._on({
        id: 'r1', user_id: 'u1', status: 'confirmed', slot_id: 's1',
        slot: { starts_at: farFuture },
        experience: { cancellation_hours: 24 },
      });
      supabase._on(null);
      await expect(service.cancel('r1', 'u1', 'user')).resolves.toBeUndefined();
    });

    it('rechaza si esta fuera de la ventana', async () => {
      const tooSoon = new Date(Date.now() + 6 * 3600_000).toISOString();
      supabase._on({
        id: 'r1', user_id: 'u1', status: 'confirmed', slot_id: 's1',
        slot: { starts_at: tooSoon },
        experience: { cancellation_hours: 24 },
      });
      await expect(service.cancel('r1', 'u1', 'user')).rejects.toThrow(BadRequestException);
    });

    it('rechaza si no es el dueno', async () => {
      const farFuture = new Date(Date.now() + 5 * 86400_000).toISOString();
      supabase._on({
        id: 'r1', user_id: 'OTHER', status: 'confirmed', slot_id: 's1',
        slot: { starts_at: farFuture },
        experience: { cancellation_hours: 24 },
      });
      await expect(service.cancel('r1', 'u1', 'user')).rejects.toThrow(ForbiddenException);
    });

    it('admin puede cancelar reservas ajenas', async () => {
      const farFuture = new Date(Date.now() + 5 * 86400_000).toISOString();
      supabase._on({
        id: 'r1', user_id: 'OTHER', status: 'confirmed', slot_id: 's1',
        slot: { starts_at: farFuture },
        experience: { cancellation_hours: 24 },
      });
      supabase._on(null);
      await expect(service.cancel('r1', 'admin-1', 'admin')).resolves.toBeUndefined();
    });

    it('rechaza si la reserva no existe', async () => {
      supabase._on(null);
      await expect(service.cancel('missing', 'u1', 'user')).rejects.toThrow(NotFoundException);
    });

    it('rechaza si ya esta cancelada', async () => {
      supabase._on({
        id: 'r1', user_id: 'u1', status: 'cancelled', slot_id: 's1',
        slot: { starts_at: new Date(Date.now() + 86400_000 * 5).toISOString() },
        experience: { cancellation_hours: 24 },
      });
      await expect(service.cancel('r1', 'u1', 'user')).rejects.toThrow(BadRequestException);
    });
  });
});
