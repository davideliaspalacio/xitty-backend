import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ScrapedItemsRepo } from './scraped-items.repo';

interface MockDbError {
  code?: string;
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

describe('ScrapedItemsRepo', () => {
  let repo: ScrapedItemsRepo;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapedItemsRepo,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    repo = module.get<ScrapedItemsRepo>(ScrapedItemsRepo);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // insertRaw
  // ─────────────────────────────────────────────────────────────────────────
  describe('insertRaw', () => {
    it('inserta raw item con dedup_hash generado', async () => {
      const chain = supabase._on({
        id: 'raw-1',
        run_id: 'run-1',
        source_id: 's1',
        source_url: 'https://x.com/y',
        dedup_hash: 'abc',
      });

      const result = await repo.insertRaw({
        runId: 'run-1',
        sourceId: 's1',
        sourceUrl: 'https://x.com/y',
        sourceExternalId: 'ext-1',
        payload: { foo: 'bar' },
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe('raw-1');
      expect(supabase.from).toHaveBeenCalledWith('scraped_items_raw');
      const inserted = firstArg<Record<string, unknown>>(chain.insert);
      expect(inserted.run_id).toBe('run-1');
      expect(inserted.source_id).toBe('s1');
      expect(inserted.source_url).toBe('https://x.com/y');
      expect(inserted.source_external_id).toBe('ext-1');
      expect(inserted.raw_payload).toEqual({ foo: 'bar' });
      expect(stringField(inserted, 'dedup_hash').length).toBeGreaterThan(0);
    });

    it('genera el mismo dedup_hash para el mismo source_url+external_id', async () => {
      const chain1 = supabase._on({ id: 'raw-1' });
      await repo.insertRaw({
        runId: 'run-1',
        sourceId: 's1',
        sourceUrl: 'https://x.com/y',
        sourceExternalId: 'ext-1',
        payload: { foo: 1 },
      });
      const chain2 = supabase._on({ id: 'raw-2' });
      await repo.insertRaw({
        runId: 'run-2',
        sourceId: 's1',
        sourceUrl: 'https://x.com/y',
        sourceExternalId: 'ext-1',
        payload: { foo: 2 },
      });

      const h1 = stringField(
        firstArg<Record<string, unknown>>(chain1.insert),
        'dedup_hash',
      );
      const h2 = stringField(
        firstArg<Record<string, unknown>>(chain2.insert),
        'dedup_hash',
      );
      expect(h1).toBe(h2);
    });

    it('retorna null si dedup_hash colide (insert ignorado)', async () => {
      // simular violacion del unique idx
      supabase._on(null, { code: '23505', message: 'duplicate key value' });
      const result = await repo.insertRaw({
        runId: 'run-1',
        sourceId: 's1',
        sourceUrl: 'https://x.com/y',
        sourceExternalId: 'ext-1',
        payload: {},
      });
      expect(result).toBeNull();
    });

    it('tira BadRequestException para errores que no son dedup', async () => {
      supabase._on(null, { code: 'XXX', message: 'db down' });
      await expect(
        repo.insertRaw({
          runId: 'run-1',
          sourceId: 's1',
          sourceUrl: 'https://x.com/y',
          sourceExternalId: 'ext-1',
          payload: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // dedupCheck
  // ─────────────────────────────────────────────────────────────────────────
  describe('dedupCheck', () => {
    it('devuelve true si el hash ya existe', async () => {
      supabase._on({ id: 'raw-existing' });
      const exists = await repo.dedupCheck('some-hash');
      expect(exists).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('scraped_items_raw');
    });

    it('devuelve false si no existe', async () => {
      supabase._on(null);
      const exists = await repo.dedupCheck('some-hash');
      expect(exists).toBe(false);
    });

    it('tira BadRequestException si supabase falla', async () => {
      supabase._on(null, { message: 'db down' });
      await expect(repo.dedupCheck('some-hash')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // insertEnriched
  // ─────────────────────────────────────────────────────────────────────────
  describe('insertEnriched', () => {
    it('inserta enriched item con status="pending"', async () => {
      const chain = supabase._on({
        id: 'enr-1',
        raw_id: 'raw-1',
        title: 'Tour mural',
        status: 'pending',
      });

      const result = await repo.insertEnriched({
        rawId: 'raw-1',
        title: 'Tour mural',
        description: 'desc',
        categoryHint: 'tour',
        locationName: 'Centro',
        lat: 10.99,
        lng: -74.78,
        startsAt: '2026-07-01T10:00:00Z',
        endsAt: '2026-07-01T12:00:00Z',
        priceCop: 50000,
        imageUrl: 'https://img/x.jpg',
        sourceUrl: 'https://src/y',
        qualityScore: 0.85,
      });

      expect(result.id).toBe('enr-1');
      expect(supabase.from).toHaveBeenCalledWith('scraped_items_enriched');
      const inserted = firstArg<Record<string, unknown>>(chain.insert);
      expect(inserted.raw_id).toBe('raw-1');
      expect(inserted.title).toBe('Tour mural');
      expect(inserted.status).toBe('pending');
      expect(inserted.quality_score).toBe(0.85);
    });

    it('tira BadRequestException si supabase falla', async () => {
      supabase._on(null, { message: 'db down' });
      await expect(
        repo.insertEnriched({ rawId: 'raw-1', title: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // listPending
  // ─────────────────────────────────────────────────────────────────────────
  describe('listPending', () => {
    it('devuelve solo enriched con status=pending ordenados', async () => {
      const chain = supabase._on([
        { id: 'e1', status: 'pending', created_at: 't2' },
        { id: 'e2', status: 'pending', created_at: 't1' },
      ]);

      const result = await repo.listPending({ limit: 50, offset: 0 });

      expect(result).toHaveLength(2);
      expect(chain.eq).toHaveBeenCalledWith('status', 'pending');
      expect(chain.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('aplica limit y offset (range)', async () => {
      const chain = supabase._on([]);
      await repo.listPending({ limit: 10, offset: 20 });
      expect(chain.range).toHaveBeenCalledWith(20, 29);
    });

    it('tira BadRequestException si supabase falla', async () => {
      supabase._on(null, { message: 'db down' });
      await expect(repo.listPending({ limit: 10, offset: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // approve / reject / publish
  // ─────────────────────────────────────────────────────────────────────────
  describe('approve', () => {
    it('marca el item como approved con reviewer + reviewed_at', async () => {
      // 1) fetch del item para validar existencia
      supabase._on({ id: 'enr-1', status: 'pending' });
      // 2) update
      const updChain = supabase._on({ id: 'enr-1', status: 'approved' });

      const result = await repo.approve('enr-1', 'admin-uid');

      expect(result.status).toBe('approved');
      const updateArg = firstArg<Record<string, unknown>>(updChain.update);
      expect(updateArg.status).toBe('approved');
      expect(updateArg.reviewed_by).toBe('admin-uid');
      expect(updateArg.reviewed_at).toBeDefined();
    });

    it('tira NotFoundException si el item no existe', async () => {
      supabase._on(null);
      await expect(repo.approve('missing', 'admin-uid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reject', () => {
    it('marca el item como rejected', async () => {
      supabase._on({ id: 'enr-1', status: 'pending' });
      const updChain = supabase._on({ id: 'enr-1', status: 'rejected' });

      const result = await repo.reject('enr-1', 'admin-uid');

      expect(result.status).toBe('rejected');
      const updateArg = firstArg<Record<string, unknown>>(updChain.update);
      expect(updateArg.status).toBe('rejected');
      expect(updateArg.reviewed_by).toBe('admin-uid');
    });

    it('tira NotFoundException si el item no existe', async () => {
      supabase._on(null);
      await expect(repo.reject('missing', 'admin-uid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('publish', () => {
    it('marca como published asociando place_id', async () => {
      supabase._on({ id: 'enr-1', status: 'approved' });
      const updChain = supabase._on({ id: 'enr-1', status: 'published' });

      const result = await repo.publish('enr-1', { placeId: 'place-1' });

      expect(result.status).toBe('published');
      const updateArg = firstArg<Record<string, unknown>>(updChain.update);
      expect(updateArg.status).toBe('published');
      expect(updateArg.published_place_id).toBe('place-1');
      expect(updateArg.published_experience_id).toBeNull();
    });

    it('marca como published asociando experience_id', async () => {
      supabase._on({ id: 'enr-1', status: 'approved' });
      const updChain = supabase._on({ id: 'enr-1', status: 'published' });

      await repo.publish('enr-1', { experienceId: 'exp-1' });

      const updateArg = firstArg<Record<string, unknown>>(updChain.update);
      expect(updateArg.published_experience_id).toBe('exp-1');
      expect(updateArg.published_place_id).toBeNull();
    });

    it('exige al menos uno de placeId/experienceId', async () => {
      await expect(repo.publish('enr-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('tira NotFoundException si el item no existe', async () => {
      supabase._on(null);
      await expect(repo.publish('missing', { placeId: 'p1' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
