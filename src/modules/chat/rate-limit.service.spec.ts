import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ChatRateLimitService } from './rate-limit.service';

interface MockDbError {
  message: string;
}

interface MockRpcResult {
  data: number | string | null;
  error: MockDbError | null;
}

type RpcMethod = jest.MockedFunction<
  (
    fn: string,
    params: {
      p_user_id: string;
    },
  ) => Promise<MockRpcResult>
>;

interface MockSupabase {
  rpc: RpcMethod;
}

function createMockSupabase(): MockSupabase {
  return {
    rpc: jest.fn<
      (
        fn: string,
        params: {
          p_user_id: string;
        },
      ) => Promise<MockRpcResult>
    >(),
  };
}

describe('ChatRateLimitService', () => {
  let service: ChatRateLimitService;
  let supabase: MockSupabase;

  async function buildService(env: Record<string, string | undefined> = {}) {
    const prev: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(env)) {
      prev[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }

    supabase = createMockSupabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatRateLimitService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
      ],
    }).compile();
    service = module.get<ChatRateLimitService>(ChatRateLimitService);

    return () => {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    };
  }

  it('usa default 30 si CHAT_DAILY_LIMIT no esta', async () => {
    const restore = await buildService({ CHAT_DAILY_LIMIT: undefined });
    expect(service.limit).toBe(30);
    restore();
  });

  it('lee CHAT_DAILY_LIMIT de env', async () => {
    const restore = await buildService({ CHAT_DAILY_LIMIT: '5' });
    expect(service.limit).toBe(5);
    restore();
  });

  it('retorna el count cuando esta debajo del limite', async () => {
    const restore = await buildService({ CHAT_DAILY_LIMIT: '5' });
    supabase.rpc.mockResolvedValueOnce({ data: 3, error: null });
    const count = await service.checkAndIncrement('u1');
    expect(count).toBe(3);
    expect(supabase.rpc).toHaveBeenCalledWith('increment_chat_usage', {
      p_user_id: 'u1',
    });
    restore();
  });

  it('tira ForbiddenException cuando supera el limite', async () => {
    const restore = await buildService({ CHAT_DAILY_LIMIT: '5' });
    supabase.rpc.mockResolvedValueOnce({ data: 6, error: null });
    await expect(service.checkAndIncrement('u1')).rejects.toThrow(
      ForbiddenException,
    );
    restore();
  });

  it('no tira pero devuelve 0 si el RPC falla (no bloquea al user)', async () => {
    const restore = await buildService();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc not found' },
    });
    const count = await service.checkAndIncrement('u1');
    expect(count).toBe(0);
    restore();
  });
});
