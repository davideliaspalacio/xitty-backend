import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { FavoritesService } from './favorites.service';

interface MockDbError {
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
  delete: ChainMethod;
  eq: ChainMethod;
  in: ChainMethod;
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
    'delete',
    'eq',
    'in',
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

describe('FavoritesService', () => {
  let service: FavoritesService;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
      ],
    }).compile();
    service = module.get<FavoritesService>(FavoritesService);
  });

  describe('toggle', () => {
    it('agrega a favoritos si no existia', async () => {
      supabase._on({ id: 'place-1' }); // place exists
      supabase._on(null); // not favorited
      supabase._on(null); // insert ok

      const result = await service.toggle('place-1', 'u1');
      expect(result).toEqual({ place_id: 'place-1', is_favorite: true });
    });

    it('quita de favoritos si ya existia', async () => {
      supabase._on({ id: 'place-1' }); // place exists
      supabase._on({ user_id: 'u1' }); // already favorited
      supabase._on(null); // delete ok

      const result = await service.toggle('place-1', 'u1');
      expect(result).toEqual({ place_id: 'place-1', is_favorite: false });
    });

    it('lanza 404 si el lugar no existe', async () => {
      supabase._on(null);
      await expect(service.toggle('x', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByUserId', () => {
    it('devuelve favoritos paginados con cover photo', async () => {
      supabase._on(
        [
          {
            place_id: 'p1',
            created_at: '2026-04-13T00:00:00Z',
            places: {
              id: 'p1',
              name: 'La Trattoria',
              average_rating: 4.5,
              total_reviews: 10,
              price_range: 2,
              categories: {
                id: 'c1',
                name: 'Restaurantes',
                slug: 'restaurantes',
                icon: 'utensils',
              },
            },
          },
        ],
        null,
        1,
      );
      supabase._on([{ place_id: 'p1', url: 'https://cover.jpg' }]); // covers

      const result = await service.findByUserId('u1', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].place.name).toBe('La Trattoria');
      expect(result.data[0].place.cover_photo_url).toBe('https://cover.jpg');
      expect(result.total).toBe(1);
    });

    it('devuelve lista vacia sin favoritos', async () => {
      supabase._on([], null, 0);
      const result = await service.findByUserId('u1', 1, 10);
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
