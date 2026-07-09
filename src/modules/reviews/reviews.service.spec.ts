import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ReviewsService } from './reviews.service';

interface MockDbError {
  code?: string;
  message?: string;
}

interface MockDbResult {
  data: unknown;
  error: MockDbError | null;
  count?: number | null;
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
  _on: (
    data: unknown,
    error?: MockDbError | null,
    count?: number | null,
  ) => MockChain;
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
    _on: (data: unknown, error?: MockDbError | null, count?: number | null) => {
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

describe('ReviewsService', () => {
  let service: ReviewsService;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
      ],
    }).compile();
    service = module.get<ReviewsService>(ReviewsService);
  });

  describe('findByPlaceId', () => {
    it('devuelve resenas paginadas con perfil del usuario', async () => {
      const reviews = [
        {
          id: 'r1',
          rating: 5,
          comment: 'Excelente!',
          profiles: { full_name: 'Juan' },
        },
        {
          id: 'r2',
          rating: 3,
          comment: 'Regular',
          profiles: { full_name: 'Maria' },
        },
      ];
      supabase._on(reviews, null, 2);

      const result = await service.findByPlaceId('place-1', 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('create', () => {
    it('turista deja resena en lugar activo', async () => {
      supabase._on({ id: 'place-1' }); // place exists
      supabase._on({
        id: 'r1',
        place_id: 'place-1',
        user_id: 'u1',
        rating: 4,
        comment: 'Bueno',
      });

      const result = await service.create('place-1', 'u1', {
        rating: 4,
        comment: 'Bueno',
      });
      expect(result.rating).toBe(4);
    });

    it('lanza 404 si el lugar no existe', async () => {
      supabase._on(null);
      await expect(service.create('x', 'u1', { rating: 5 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza 409 si ya reseno (una por usuario por lugar)', async () => {
      supabase._on({ id: 'place-1' });
      supabase._on(null, { code: '23505', message: 'duplicate' });
      await expect(
        service.create('place-1', 'u1', { rating: 3 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('usuario edita su resena', async () => {
      supabase._on({ id: 'r1', rating: 5, comment: 'Mejor' });
      const result = await service.update('place-1', 'u1', {
        rating: 5,
        comment: 'Mejor',
      });
      expect(result.rating).toBe(5);
    });

    it('lanza 404 si la resena no existe', async () => {
      supabase._on(null);
      await expect(service.update('p1', 'u1', { rating: 2 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('requiere al menos un campo', async () => {
      await expect(service.update('p1', 'u1', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('usuario elimina su resena', async () => {
      supabase._on(null);
      await expect(service.remove('place-1', 'u1')).resolves.toBeUndefined();
    });
  });
});
