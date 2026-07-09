import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ConsentsService } from './consents.service';
import { ConsentType } from './dto/grant-consent.dto';

interface MockDbError {
  message?: string;
}

interface MockDbResult {
  data: unknown;
  error: MockDbError | null;
}

interface ConsentUpsertPayload {
  user_id: string;
  consent_type: ConsentType;
  granted: boolean;
  granted_at?: string;
  revoked_at: string | null;
}

type ChainMethod = jest.MockedFunction<(...args: unknown[]) => MockChain>;

interface MockChain extends PromiseLike<MockDbResult> {
  from: ChainMethod;
  select: ChainMethod;
  upsert: ChainMethod;
  insert: ChainMethod;
  update: ChainMethod;
  delete: ChainMethod;
  eq: ChainMethod;
  in: ChainMethod;
  order: ChainMethod;
  maybeSingle: ChainMethod;
  single: ChainMethod;
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
    'upsert',
    'insert',
    'update',
    'delete',
    'eq',
    'in',
    'order',
    'maybeSingle',
    'single',
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

function getFirstUpsertPayload(chain: MockChain): ConsentUpsertPayload {
  const payload = chain.upsert.mock.calls[0]?.[0];
  return payload as ConsentUpsertPayload;
}

describe('ConsentsService', () => {
  let service: ConsentsService;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentsService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
      ],
    }).compile();
    service = module.get<ConsentsService>(ConsentsService);
  });

  describe('grant', () => {
    it('crea un row con granted=true y revoked_at=null', async () => {
      const now = new Date().toISOString();
      const chain = supabase._on({
        user_id: 'u1',
        consent_type: 'location_tracking',
        granted: true,
        granted_at: now,
        revoked_at: null,
      });

      const result = await service.grant('u1', {
        consent_type: ConsentType.LOCATION_TRACKING,
      });

      expect(result.granted).toBe(true);
      expect(result.consent_type).toBe('location_tracking');
      expect(result.revoked_at).toBeNull();
      // Verifica que se llamó upsert con la fila esperada
      expect(chain.upsert).toHaveBeenCalled();
      const upsertArg = getFirstUpsertPayload(chain);
      expect(upsertArg.user_id).toBe('u1');
      expect(upsertArg.consent_type).toBe('location_tracking');
      expect(upsertArg.granted).toBe(true);
      expect(upsertArg.revoked_at).toBeNull();
    });

    it('rechaza consent_type inválido con BadRequestException', async () => {
      await expect(
        service.grant('u1', {
          consent_type: 'banana' as unknown as ConsentType,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revoke', () => {
    it('setea revoked_at y granted=false', async () => {
      const revokedAt = new Date().toISOString();
      const chain = supabase._on({
        user_id: 'u1',
        consent_type: 'location_tracking',
        granted: false,
        granted_at: revokedAt,
        revoked_at: revokedAt,
      });

      const result = await service.revoke('u1', ConsentType.LOCATION_TRACKING);

      expect(result.granted).toBe(false);
      expect(result.revoked_at).toBeTruthy();
      expect(chain.upsert).toHaveBeenCalled();
      const upsertArg = getFirstUpsertPayload(chain);
      expect(upsertArg.granted).toBe(false);
      expect(upsertArg.revoked_at).toBeTruthy();
      // Auditoría Ley 1581: revoke NO debe tocar granted_at (preserva la fecha
      // original de otorgamiento). En UPDATE se conserva; en INSERT nuevo toma
      // el DEFAULT now() de la columna.
      expect(upsertArg.granted_at).toBeUndefined();
    });

    it('rechaza consent_type inválido en revoke', async () => {
      await expect(
        service.revoke('u1', 'banana' as unknown as ConsentType),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getByUser', () => {
    it('retorna array de consents del usuario', async () => {
      supabase._on([
        {
          user_id: 'u1',
          consent_type: 'location_tracking',
          granted: true,
          granted_at: '2026-06-01T00:00:00Z',
          revoked_at: null,
        },
        {
          user_id: 'u1',
          consent_type: 'marketing',
          granted: false,
          granted_at: '2026-05-01T00:00:00Z',
          revoked_at: '2026-05-15T00:00:00Z',
        },
      ]);

      const result = await service.getByUser('u1');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].consent_type).toBe('location_tracking');
      expect(result[0].granted).toBe(true);
      expect(result[1].consent_type).toBe('marketing');
      expect(result[1].granted).toBe(false);
    });

    it('retorna array vacío si el usuario no tiene consents', async () => {
      supabase._on([]);
      const result = await service.getByUser('u1');
      expect(result).toEqual([]);
    });

    it('retorna array vacío si data es null', async () => {
      supabase._on(null);
      const result = await service.getByUser('u1');
      expect(result).toEqual([]);
    });
  });
});
