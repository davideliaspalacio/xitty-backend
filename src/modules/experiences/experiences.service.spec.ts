import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExperiencesService } from './experiences.service';

function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete',
    'eq', 'gte', 'lte', 'lt', 'in', 'overlaps',
    'order', 'range', 'single', 'maybeSingle',
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

describe('ExperiencesService', () => {
  let service: ExperiencesService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperiencesService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get<ExperiencesService>(ExperiencesService);
  });

  // ── Catalog ────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('lista experiencias con filtros y agrega cover_photo_url', async () => {
      supabase._on(
        [
          { id: 'e1', title: 'Tour del Centro', slug: 'tour-centro', description: null, experience_type: 'tour', tags: ['cultural'], duration_minutes: 120, price_cop: 60000, average_rating: 4.7, total_reviews: 30 },
        ],
        null,
        1,
      );
      supabase._on([{ experience_id: 'e1', url: 'https://img/cover.jpg' }]);

      const result = await service.findAll({
        experience_type: 'tour' as any,
        sort_by: 'rating' as any,
        page: 1,
        limit: 10,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].cover_photo_url).toBe('https://img/cover.jpg');
      expect(result.total).toBe(1);
    });

    it('devuelve vacio si no hay slots disponibles para available_on', async () => {
      // 1) slots view → empty
      supabase._on([]);
      const result = await service.findAll({
        available_on: '2026-05-15',
      } as any);
      expect(result.data).toEqual([]);
    });
  });

  // ── Detail ────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('devuelve la experience con galeria', async () => {
      supabase._on({
        id: 'e1', operator_place_id: 'p1', title: 'X', slug: 'x',
        description: null, experience_type: 'tour', tags: [],
        duration_minutes: 120, price_cop: 60000,
        min_participants: 1, max_participants: 10,
        meeting_point_address: null, meeting_point_latitude: null, meeting_point_longitude: null,
        cancellation_hours: 24, average_rating: 5, total_reviews: 1,
        is_active: true, created_at: 'now', updated_at: 'now',
      });
      supabase._on([
        { id: 'ph1', url: 'https://img/1.jpg', alt_text: null, is_cover: true, display_order: 0 },
      ]);
      const result = await service.findById('e1');
      expect(result.id).toBe('e1');
      expect(result.cover_photo_url).toBe('https://img/1.jpg');
      expect(result.photos).toHaveLength(1);
    });

    it('lanza 404 si no existe', async () => {
      supabase._on(null, { code: 'PGRST116' });
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Create ────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      operator_place_id: 'p1',
      title: 'Tour',
      experience_type: 'tour' as any,
      duration_minutes: 120,
      price_cop: 60000,
    };

    it('rechaza a un user que no es business ni admin', async () => {
      await expect(
        service.create('user-1', 'user', dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza si el operator no le pertenece', async () => {
      supabase._on({ owner_id: 'other-owner' });
      await expect(
        service.create('user-1', 'business', dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('owner puede crear', async () => {
      supabase._on({ owner_id: 'user-1' });
      supabase._on({
        id: 'new-id', ...dto, slug: 'tour',
        average_rating: 0, total_reviews: 0, is_active: true,
        min_participants: 1, max_participants: 10, cancellation_hours: 24,
        meeting_point_address: null, meeting_point_latitude: null, meeting_point_longitude: null,
        tags: [], description: null,
        created_at: 'now', updated_at: 'now',
      });
      const result = await service.create('user-1', 'business', dto);
      expect(result.id).toBe('new-id');
    });

    it('admin puede crear sin chequeo de ownership', async () => {
      supabase._on({
        id: 'new-id', ...dto, slug: 'tour',
        average_rating: 0, total_reviews: 0, is_active: true,
        min_participants: 1, max_participants: 10, cancellation_hours: 24,
        meeting_point_address: null, meeting_point_latitude: null, meeting_point_longitude: null,
        tags: [], description: null,
        created_at: 'now', updated_at: 'now',
      });
      const result = await service.create('admin-1', 'admin', dto);
      expect(result.id).toBe('new-id');
    });
  });

  // ── Slots ─────────────────────────────────────────────────────────────

  describe('createSlot', () => {
    it('rechaza fecha pasada', async () => {
      // first call: assertExperienceOwnership
      supabase._on({ id: 'e1', operator_place_id: 'p1', places: { owner_id: 'user-1' } });
      await expect(
        service.createSlot('e1', 'user-1', 'business', {
          starts_at: '2020-01-01T00:00:00Z',
          capacity: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea el slot si todo OK', async () => {
      supabase._on({ id: 'e1', operator_place_id: 'p1', places: { owner_id: 'user-1' } });
      const future = new Date(Date.now() + 7 * 86400_000).toISOString();
      supabase._on({
        id: 's1', experience_id: 'e1', starts_at: future, capacity: 8, seats_taken: 0, is_active: true,
      });
      const result = await service.createSlot('e1', 'user-1', 'business', {
        starts_at: future,
        capacity: 8,
      });
      expect(result.id).toBe('s1');
      expect(result.seats_available).toBe(8);
    });
  });

  describe('deleteSlot', () => {
    it('soft-delete cuando hay reservaciones', async () => {
      supabase._on({ id: 'e1', operator_place_id: 'p1', places: { owner_id: 'user-1' } });
      supabase._on({ id: 's1', seats_taken: 3 });
      supabase._on(null);
      const result = await service.deleteSlot('e1', 's1', 'user-1', 'business');
      expect(result.soft_deleted).toBe(true);
    });

    it('hard delete cuando no hay reservaciones', async () => {
      supabase._on({ id: 'e1', operator_place_id: 'p1', places: { owner_id: 'user-1' } });
      supabase._on({ id: 's1', seats_taken: 0 });
      supabase._on(null);
      const result = await service.deleteSlot('e1', 's1', 'user-1', 'business');
      expect(result.soft_deleted).toBe(false);
    });
  });
});
