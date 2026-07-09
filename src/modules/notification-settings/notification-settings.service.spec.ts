import { Test, TestingModule } from '@nestjs/testing';
import type { SupabaseClient } from '@supabase/supabase-js';

import { NotificationSettingsService } from './notification-settings.service';

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
  upsert: ChainMethod;
  eq: ChainMethod;
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
    'eq',
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

describe('NotificationSettingsService', () => {
  let service: NotificationSettingsService;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationSettingsService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
      ],
    }).compile();
    service = module.get<NotificationSettingsService>(
      NotificationSettingsService,
    );
  });

  describe('getOrDefaults', () => {
    it('devuelve los settings guardados si existen', async () => {
      supabase._on({
        user_id: 'u1',
        notify_call_click: false,
        notify_whatsapp_click: true,
        notify_reservation_click: true,
        daily_summary: false,
      });

      const result = await service.getOrDefaults('u1');
      expect(result.notify_call_click).toBe(false);
      expect(result.daily_summary).toBe(false);
    });

    it('devuelve defaults (todos true) si no hay row', async () => {
      supabase._on(null);
      const result = await service.getOrDefaults('u1');
      expect(result.user_id).toBe('u1');
      expect(result.notify_call_click).toBe(true);
      expect(result.notify_whatsapp_click).toBe(true);
      expect(result.notify_reservation_click).toBe(true);
      expect(result.daily_summary).toBe(true);
    });
  });

  describe('upsert', () => {
    it('hace upsert con los campos del DTO', async () => {
      const chain = supabase._on({
        user_id: 'u1',
        notify_call_click: true,
        notify_whatsapp_click: false,
        notify_reservation_click: true,
        daily_summary: true,
      });

      const result = await service.upsert('u1', {
        notify_whatsapp_click: false,
      });

      expect(chain.upsert).toHaveBeenCalledWith(
        {
          user_id: 'u1',
          notify_call_click: true,
          notify_whatsapp_click: false,
          notify_reservation_click: true,
          daily_summary: true,
        },
        { onConflict: 'user_id' },
      );
      expect(result.notify_whatsapp_click).toBe(false);
    });
  });
});
