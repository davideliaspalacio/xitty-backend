import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ExperiencesService } from './experiences.service';
import type { CreateExperienceDto } from './dto/create-experience.dto';
import type { ExperienceListQueryDto } from './dto/experience-list-query.dto';

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
  gte: ChainMethod;
  lte: ChainMethod;
  lt: ChainMethod;
  in: ChainMethod;
  overlaps: ChainMethod;
  order: ChainMethod;
  range: ChainMethod;
  single: ChainMethod;
  maybeSingle: ChainMethod;
}

interface MockSupabase {
  from: ChainMethod;
  _on: (data: unknown, error?: MockDbError | null, count?: number) => MockChain;
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
    'gte',
    'lte',
    'lt',
    'in',
    'overlaps',
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

describe('ExperiencesService', () => {
  let service: ExperiencesService;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperiencesService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
      ],
    }).compile();
    service = module.get<ExperiencesService>(ExperiencesService);
  });

  // ── Catalog ────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('lista experiencias con filtros y agrega cover_photo_url', async () => {
      supabase._on(
        [
          {
            id: 'e1',
            title: 'Tour del Centro',
            slug: 'tour-centro',
            description: null,
            experience_type: 'tour',
            tags: ['cultural'],
            duration_minutes: 120,
            price_cop: 60000,
            average_rating: 4.7,
            total_reviews: 30,
          },
        ],
        null,
        1,
      );
      supabase._on([{ experience_id: 'e1', url: 'https://img/cover.jpg' }]);

      const query: ExperienceListQueryDto = {
        experience_type: 'tour',
        sort_by: 'rating',
        page: 1,
        limit: 10,
      };
      const result = await service.findAll(query);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].cover_photo_url).toBe('https://img/cover.jpg');
      expect(result.total).toBe(1);
    });

    it('devuelve vacio si no hay slots disponibles para available_on', async () => {
      // 1) slots view → empty
      supabase._on([]);
      const query: ExperienceListQueryDto = {
        available_on: '2026-05-15',
      };
      const result = await service.findAll(query);
      expect(result.data).toEqual([]);
    });
  });

  // ── Detail ────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('devuelve la experience con galeria', async () => {
      supabase._on({
        id: 'e1',
        operator_place_id: 'p1',
        title: 'X',
        slug: 'x',
        description: null,
        experience_type: 'tour',
        tags: [],
        duration_minutes: 120,
        price_cop: 60000,
        min_participants: 1,
        max_participants: 10,
        meeting_point_address: null,
        meeting_point_latitude: null,
        meeting_point_longitude: null,
        cancellation_hours: 24,
        average_rating: 5,
        total_reviews: 1,
        is_active: true,
        created_at: 'now',
        updated_at: 'now',
      });
      supabase._on([
        {
          id: 'ph1',
          url: 'https://img/1.jpg',
          alt_text: null,
          is_cover: true,
          display_order: 0,
        },
      ]);
      const result = await service.findById('e1');
      expect(result.id).toBe('e1');
      expect(result.cover_photo_url).toBe('https://img/1.jpg');
      expect(result.photos).toHaveLength(1);
    });

    it('lanza 404 si no existe', async () => {
      supabase._on(null, { code: 'PGRST116' });
      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── Create ────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateExperienceDto = {
      operator_place_id: 'p1',
      title: 'Tour',
      experience_type: 'tour',
      duration_minutes: 120,
      price_cop: 60000,
    };

    it('rechaza a un user que no es business ni admin', async () => {
      await expect(service.create('user-1', 'user', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rechaza si el operator no le pertenece', async () => {
      supabase._on({ owner_id: 'other-owner' });
      await expect(service.create('user-1', 'business', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('owner puede crear', async () => {
      supabase._on({ owner_id: 'user-1' });
      supabase._on({
        id: 'new-id',
        ...dto,
        slug: 'tour',
        average_rating: 0,
        total_reviews: 0,
        is_active: true,
        min_participants: 1,
        max_participants: 10,
        cancellation_hours: 24,
        meeting_point_address: null,
        meeting_point_latitude: null,
        meeting_point_longitude: null,
        tags: [],
        description: null,
        created_at: 'now',
        updated_at: 'now',
      });
      const result = await service.create('user-1', 'business', dto);
      expect(result.id).toBe('new-id');
    });

    it('admin puede crear sin chequeo de ownership', async () => {
      supabase._on({
        id: 'new-id',
        ...dto,
        slug: 'tour',
        average_rating: 0,
        total_reviews: 0,
        is_active: true,
        min_participants: 1,
        max_participants: 10,
        cancellation_hours: 24,
        meeting_point_address: null,
        meeting_point_latitude: null,
        meeting_point_longitude: null,
        tags: [],
        description: null,
        created_at: 'now',
        updated_at: 'now',
      });
      const result = await service.create('admin-1', 'admin', dto);
      expect(result.id).toBe('new-id');
    });
  });

  // ── Slots ─────────────────────────────────────────────────────────────

  describe('createSlot', () => {
    it('rechaza fecha pasada', async () => {
      // first call: assertExperienceOwnership
      supabase._on({
        id: 'e1',
        operator_place_id: 'p1',
        places: { owner_id: 'user-1' },
      });
      await expect(
        service.createSlot('e1', 'user-1', 'business', {
          starts_at: '2020-01-01T00:00:00Z',
          capacity: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea el slot si todo OK', async () => {
      supabase._on({
        id: 'e1',
        operator_place_id: 'p1',
        places: { owner_id: 'user-1' },
      });
      const future = new Date(Date.now() + 7 * 86400_000).toISOString();
      supabase._on({
        id: 's1',
        experience_id: 'e1',
        starts_at: future,
        capacity: 8,
        seats_taken: 0,
        is_active: true,
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
      supabase._on({
        id: 'e1',
        operator_place_id: 'p1',
        places: { owner_id: 'user-1' },
      });
      supabase._on({ id: 's1', seats_taken: 3 });
      supabase._on(null);
      const result = await service.deleteSlot('e1', 's1', 'user-1', 'business');
      expect(result.soft_deleted).toBe(true);
    });

    it('hard delete cuando no hay reservaciones', async () => {
      supabase._on({
        id: 'e1',
        operator_place_id: 'p1',
        places: { owner_id: 'user-1' },
      });
      supabase._on({ id: 's1', seats_taken: 0 });
      supabase._on(null);
      const result = await service.deleteSlot('e1', 's1', 'user-1', 'business');
      expect(result.soft_deleted).toBe(false);
    });
  });
});
