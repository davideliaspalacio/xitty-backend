import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ScrapingSourcesRepo } from './scraping-sources.repo';

// ── Supabase chain mock (mismo patron que chat.service.spec.ts) ─────────────
function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'order', 'range', 'limit',
    'single', 'maybeSingle',
  ];
  methods.forEach((m) => (chain[m] = jest.fn().mockReturnValue(chain)));
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createMockSupabase() {
  const mock: any = { from: jest.fn(), rpc: jest.fn() };
  mock._on = (data: any, error?: any) => {
    const c = createChain({ data, error: error || null });
    mock.from.mockReturnValueOnce(c);
    return c;
  };
  mock.from.mockImplementation(() => createChain({ data: null, error: null }));
  return mock;
}

describe('ScrapingSourcesRepo', () => {
  let repo: ScrapingSourcesRepo;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapingSourcesRepo,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    repo = module.get<ScrapingSourcesRepo>(ScrapingSourcesRepo);
  });

  describe('findAll', () => {
    it('devuelve la lista ordenada por nombre', async () => {
      supabase._on([
        { id: 's1', name: 'foursquare', kind: 'google_places', config: {}, enabled: true },
        { id: 's2', name: 'tavily-bquilla', kind: 'tavily', config: {}, enabled: false },
      ]);

      const result = await repo.findAll();

      expect(result).toHaveLength(2);
      expect(supabase.from).toHaveBeenCalledWith('scraping_sources');
    });

    it('soporta filtro enabledOnly=true', async () => {
      const chain = supabase._on([]);
      await repo.findAll({ enabledOnly: true });
      expect(chain.eq).toHaveBeenCalledWith('enabled', true);
    });

    it('tira BadRequestException si supabase falla', async () => {
      supabase._on(null, { message: 'db down' });
      await expect(repo.findAll()).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('devuelve la source si existe', async () => {
      supabase._on({ id: 's1', name: 'foursquare', kind: 'google_places', config: {}, enabled: true });
      const result = await repo.findById('s1');
      expect(result.id).toBe('s1');
    });

    it('tira NotFoundException si no existe', async () => {
      supabase._on(null);
      await expect(repo.findById('missing')).rejects.toThrow(NotFoundException);
    });

    it('tira BadRequestException si supabase falla', async () => {
      supabase._on(null, { message: 'db down' });
      await expect(repo.findById('s1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('upsert', () => {
    it('inserta nueva source y retorna row', async () => {
      const input = {
        name: 'eventbrite-bquilla',
        kind: 'eventbrite' as const,
        config: { query: 'Barranquilla' },
        enabled: true,
      };
      supabase._on({ id: 'new-id', ...input });

      const result = await repo.upsert(input);

      expect(result.id).toBe('new-id');
      expect(supabase.from).toHaveBeenCalledWith('scraping_sources');
    });

    it('hace upsert sobre conflict en name', async () => {
      const chain = supabase._on({ id: 's1' });
      await repo.upsert({
        name: 'foursquare',
        kind: 'google_places',
        config: {},
        enabled: true,
      });
      expect(chain.upsert).toHaveBeenCalled();
      const upsertArg = chain.upsert.mock.calls[0][0];
      const upsertOpts = chain.upsert.mock.calls[0][1];
      expect(upsertArg.name).toBe('foursquare');
      expect(upsertOpts?.onConflict).toBe('name');
    });

    it('tira BadRequestException si supabase falla', async () => {
      supabase._on(null, { message: 'duplicate' });
      await expect(
        repo.upsert({ name: 'x', kind: 'manual', config: {}, enabled: true }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('markRun', () => {
    it('actualiza last_run_at de la source', async () => {
      const chain = supabase._on(null);
      await repo.markRun('s1');
      expect(chain.update).toHaveBeenCalled();
      const updateArg = chain.update.mock.calls[0][0];
      expect(updateArg.last_run_at).toBeDefined();
      expect(chain.eq).toHaveBeenCalledWith('id', 's1');
    });

    it('no tira si update falla (best effort)', async () => {
      supabase._on(null, { message: 'whatever' });
      await expect(repo.markRun('s1')).resolves.toBeUndefined();
    });
  });
});
