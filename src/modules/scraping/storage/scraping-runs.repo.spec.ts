import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { ScrapingRunsRepo } from './scraping-runs.repo';

interface MockDbError {
  message: string;
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
  update: ChainMethod;
  delete: ChainMethod;
  eq: ChainMethod;
  neq: ChainMethod;
  in: ChainMethod;
  order: ChainMethod;
  range: ChainMethod;
  limit: ChainMethod;
  single: ChainMethod;
  maybeSingle: ChainMethod;
}

interface MockSupabase {
  from: ChainMethod;
  _on: (data: unknown, error?: MockDbError) => MockChain;
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
    'neq',
    'in',
    'order',
    'range',
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
    _on: (data: unknown, error?: MockDbError) => {
      const c = createChain({ data, error: error ?? null });
      mock.from.mockReturnValueOnce(c);
      return c;
    },
  };
  mock.from.mockImplementation(() => createChain({ data: null, error: null }));
  return mock;
}

function firstArg<T>(method: ChainMethod): T {
  const value = method.mock.calls[0]?.[0];
  return value as T;
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Expected ${key} to be a string`);
  }
  return value;
}

describe('ScrapingRunsRepo', () => {
  let repo: ScrapingRunsRepo;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapingRunsRepo,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    repo = module.get<ScrapingRunsRepo>(ScrapingRunsRepo);
  });

  describe('start', () => {
    it('crea un run con status="running" y retorna id', async () => {
      const chain = supabase._on({
        id: 'run-1',
        source_id: 's1',
        status: 'running',
        triggered_by: 'cron',
        started_at: 'now',
      });

      const result = await repo.start('s1', 'cron');

      expect(result.id).toBe('run-1');
      expect(result.status).toBe('running');
      expect(supabase.from).toHaveBeenCalledWith('scraping_runs');
      const insertArg = firstArg<Record<string, unknown>>(chain.insert);
      expect(insertArg.source_id).toBe('s1');
      expect(insertArg.status).toBe('running');
      expect(insertArg.triggered_by).toBe('cron');
    });

    it('tira BadRequestException si supabase falla', async () => {
      supabase._on(null, { message: 'db down' });
      await expect(repo.start('s1', 'cron')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('finish', () => {
    it('marca el run como succeeded con counters', async () => {
      const chain = supabase._on(null);
      await repo.finish('run-1', {
        status: 'succeeded',
        itemsFound: 10,
        itemsEnriched: 8,
        itemsFailed: 2,
      });

      expect(supabase.from).toHaveBeenCalledWith('scraping_runs');
      const updateArg = firstArg<Record<string, unknown>>(chain.update);
      expect(updateArg.status).toBe('succeeded');
      expect(updateArg.items_found).toBe(10);
      expect(updateArg.items_enriched).toBe(8);
      expect(updateArg.items_failed).toBe(2);
      expect(updateArg.finished_at).toBeDefined();
      expect(chain.eq).toHaveBeenCalledWith('id', 'run-1');
    });

    it('soporta status partial', async () => {
      const chain = supabase._on(null);
      await repo.finish('run-1', {
        status: 'partial',
        itemsFound: 10,
        itemsEnriched: 6,
        itemsFailed: 4,
      });
      const updateArg = firstArg<Record<string, unknown>>(chain.update);
      expect(updateArg.status).toBe('partial');
    });

    it('tira BadRequestException si supabase falla', async () => {
      supabase._on(null, { message: 'db down' });
      await expect(
        repo.finish('run-1', {
          status: 'succeeded',
          itemsFound: 0,
          itemsEnriched: 0,
          itemsFailed: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('error', () => {
    it('marca el run como failed con mensaje de error', async () => {
      const chain = supabase._on(null);
      await repo.error('run-1', 'foursquare returned 500');

      const updateArg = firstArg<Record<string, unknown>>(chain.update);
      expect(updateArg.status).toBe('failed');
      expect(updateArg.error).toBe('foursquare returned 500');
      expect(updateArg.finished_at).toBeDefined();
    });

    it('no tira si update falla (best effort)', async () => {
      supabase._on(null, { message: 'db down' });
      await expect(repo.error('run-1', 'boom')).resolves.toBeUndefined();
    });

    it('trunca mensajes de error muy largos', async () => {
      const huge = 'x'.repeat(5000);
      const chain = supabase._on(null);
      await repo.error('run-1', huge);
      const updateArg = firstArg<Record<string, unknown>>(chain.update);
      expect(stringField(updateArg, 'error').length).toBeLessThanOrEqual(2000);
    });
  });
});
