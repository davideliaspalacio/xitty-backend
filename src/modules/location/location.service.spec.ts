import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { LocationService } from './location.service';

interface MockDbError {
  message?: string;
}

interface MockDbResult {
  data: unknown;
  error: MockDbError | null;
}

type ChainMethod = jest.MockedFunction<(...args: unknown[]) => MockChain>;

interface MockChain extends PromiseLike<MockDbResult> {
  from: ChainMethod;
  select: ChainMethod;
  insert: ChainMethod;
  delete: ChainMethod;
  eq: ChainMethod;
  order: ChainMethod;
  limit: ChainMethod;
  single: ChainMethod;
  maybeSingle: ChainMethod;
}

interface MockSupabase {
  from: ChainMethod;
  _on: (data: unknown, error?: MockDbError | null) => MockChain;
}

function createChain(result: MockDbResult): MockChain {
  const chain = {} as MockChain;
  const methods = [
    'from',
    'select',
    'insert',
    'delete',
    'eq',
    'order',
    'limit',
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
    _on: (data: unknown, error?: MockDbError | null) => {
      const c = createChain({ data, error: error ?? null });
      mock.from.mockReturnValueOnce(c);
      return c;
    },
  };
  mock.from.mockImplementation(() => createChain({ data: null, error: null }));
  return mock;
}

describe('LocationService', () => {
  let service: LocationService;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
      ],
    }).compile();
    service = module.get<LocationService>(LocationService);
  });

  describe('saveSnapshots', () => {
    it('persiste cada snapshot con el user_id correcto', async () => {
      const inserted = [
        {
          id: 'snap-1',
          user_id: 'u1',
          latitude: 10.99,
          longitude: -74.79,
          accuracy_m: 15,
          source: 'browser_gps',
          created_at: '2026-06-03T12:00:00Z',
        },
        {
          id: 'snap-2',
          user_id: 'u1',
          latitude: 11.0,
          longitude: -74.8,
          accuracy_m: 20,
          source: 'browser_gps',
          created_at: '2026-06-03T12:01:00Z',
        },
      ];
      const chain = supabase._on(inserted);

      const result = await service.saveSnapshots('u1', {
        snapshots: [
          { lat: 10.99, lng: -74.79, accuracy: 15 },
          { lat: 11.0, lng: -74.8, accuracy: 20 },
        ],
      });

      expect(supabase.from).toHaveBeenCalledWith('user_location_snapshots');
      expect(chain.insert).toHaveBeenCalledWith([
        {
          user_id: 'u1',
          latitude: 10.99,
          longitude: -74.79,
          accuracy_m: 15,
          source: 'browser_gps',
        },
        {
          user_id: 'u1',
          latitude: 11.0,
          longitude: -74.8,
          accuracy_m: 20,
          source: 'browser_gps',
        },
      ]);
      expect(result.inserted).toBe(2);
    });

    it('rechaza si el batch trae mas de 10 snapshots', async () => {
      const snapshots = Array.from({ length: 11 }, (_, i) => ({
        lat: 10 + i * 0.001,
        lng: -74,
      }));
      await expect(service.saveSnapshots('u1', { snapshots })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza si el batch esta vacio', async () => {
      await expect(
        service.saveSnapshots('u1', { snapshots: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza latitud fuera de rango', async () => {
      await expect(
        service.saveSnapshots('u1', {
          snapshots: [{ lat: 91, lng: -74 }],
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.saveSnapshots('u1', {
          snapshots: [{ lat: -91, lng: -74 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza longitud fuera de rango', async () => {
      await expect(
        service.saveSnapshots('u1', {
          snapshots: [{ lat: 10, lng: 181 }],
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.saveSnapshots('u1', {
          snapshots: [{ lat: 10, lng: -181 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteMine', () => {
    it('borra todos los snapshots del user', async () => {
      const chain = supabase._on(null);
      const result = await service.deleteMine('u1');
      expect(supabase.from).toHaveBeenCalledWith('user_location_snapshots');
      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('getLatest', () => {
    it('devuelve el snapshot mas reciente del user', async () => {
      const snap = {
        id: 'snap-9',
        user_id: 'u1',
        latitude: 10.99,
        longitude: -74.79,
        accuracy_m: 12,
        source: 'browser_gps',
        created_at: '2026-06-03T12:30:00Z',
      };
      supabase._on(snap);
      const result = await service.getLatest('u1');
      expect(result).toEqual(snap);
    });

    it('devuelve null si el user no tiene snapshots', async () => {
      supabase._on(null);
      const result = await service.getLatest('u1');
      expect(result).toBeNull();
    });
  });
});
