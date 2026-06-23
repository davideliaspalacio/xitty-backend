import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { ScrapingRunsRepo } from './scraping-runs.repo';

function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'in', 'order', 'range', 'limit',
    'single', 'maybeSingle',
  ];
  methods.forEach((m) => (chain[m] = jest.fn().mockReturnValue(chain)));
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createMockSupabase() {
  const mock: any = { from: jest.fn() };
  mock._on = (data: any, error?: any) => {
    const c = createChain({ data, error: error || null });
    mock.from.mockReturnValueOnce(c);
    return c;
  };
  mock.from.mockImplementation(() => createChain({ data: null, error: null }));
  return mock;
}

describe('ScrapingRunsRepo', () => {
  let repo: ScrapingRunsRepo;
  let supabase: any;

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
      const insertArg = chain.insert.mock.calls[0][0];
      expect(insertArg.source_id).toBe('s1');
      expect(insertArg.status).toBe('running');
      expect(insertArg.triggered_by).toBe('cron');
    });

    it('tira BadRequestException si supabase falla', async () => {
      supabase._on(null, { message: 'db down' });
      await expect(repo.start('s1', 'cron')).rejects.toThrow(BadRequestException);
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
      const updateArg = chain.update.mock.calls[0][0];
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
      const updateArg = chain.update.mock.calls[0][0];
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

      const updateArg = chain.update.mock.calls[0][0];
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
      const updateArg = chain.update.mock.calls[0][0];
      expect(updateArg.error.length).toBeLessThanOrEqual(2000);
    });
  });
});
