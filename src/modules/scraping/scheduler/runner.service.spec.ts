import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RunnerService } from './runner.service';
import {
  ENRICHMENT_SERVICE,
  QUALITY_SERVICE,
  SCRAPER_SOURCES,
  EnrichedItem,
  EnrichmentService,
  QualityService,
  RawItem,
  ScraperSource,
} from '../scraper-source.interface';

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Construye un chain awaitable para Supabase: cada metodo devuelve el chain,
 * y `await chain` resuelve al `result` precargado.
 */
function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'ilike', 'in', 'not', 'order', 'range',
    'single', 'maybeSingle',
  ];
  methods.forEach((m) => (chain[m] = jest.fn().mockReturnValue(chain)));
  chain.then = (resolve: any, reject?: any) => {
    try { return Promise.resolve(result).then(resolve, reject); }
    catch (e) { if (reject) return reject(e); throw e; }
  };
  return chain;
}

function createMockSupabase() {
  const mock: any = {
    from: jest.fn(),
    rpc: jest.fn(),
  };
  // Por default, todas las llamadas a .from() devuelven un chain OK.
  mock.from.mockImplementation(() =>
    createChain({ data: null, error: null, count: null }),
  );
  return mock;
}

/** Helper para crear un mock source. */
function mockSource(overrides: Partial<ScraperSource> = {}): jest.Mocked<ScraperSource> {
  return {
    id: 'mock-source',
    name: 'Mock Source',
    enabled: true,
    fetch: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as jest.Mocked<ScraperSource>;
}

function rawItem(over: Partial<RawItem> = {}): RawItem {
  return {
    external_id: 'ext-1',
    name: 'Test Place',
    description: 'Una descripcion',
    category: 'restaurante',
    address: 'Calle 84 #45-21',
    latitude: 10.99,
    longitude: -74.79,
    ...over,
  };
}

function enrichedFrom(item: RawItem, quality_score = 0.9): EnrichedItem {
  return {
    ...item,
    description: item.description ?? 'enriched description',
    category: item.category ?? 'restaurante',
    latitude: item.latitude ?? 10.99,
    longitude: item.longitude ?? -74.79,
    quality_score,
  };
}

// ── Suite ──────────────────────────────────────────────────────────────

describe('RunnerService', () => {
  let runner: RunnerService;
  let supabase: any;
  let enrichment: jest.Mocked<EnrichmentService>;
  let quality: jest.Mocked<QualityService>;
  let sources: ScraperSource[];

  // Helper para reconstruir el module con un set distinto de sources.
  async function build(srcs: ScraperSource[]) {
    sources = srcs;
    supabase = createMockSupabase();
    enrichment = {
      enrich: jest.fn().mockImplementation(async (i: RawItem) => enrichedFrom(i)),
    } as any;
    quality = {
      score: jest.fn().mockImplementation(async (i: EnrichedItem) => ({
        score: i.quality_score,
        reason: 'ok',
        passes: i.quality_score >= 0.5,
      })),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunnerService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
        { provide: SCRAPER_SOURCES, useValue: sources },
        { provide: ENRICHMENT_SERVICE, useValue: enrichment },
        { provide: QUALITY_SERVICE, useValue: quality },
      ],
    }).compile();

    runner = module.get(RunnerService);
  }

  // ── runSource — happy path ──────────────────────────────────────────

  describe('runSource — happy path', () => {
    it('orquesta fetch → enrich → quality y devuelve el summary', async () => {
      const src = mockSource({
        id: 'tripadvisor',
        fetch: jest.fn().mockResolvedValue([
          rawItem({ external_id: 'a', name: 'Lugar A' }),
          rawItem({ external_id: 'b', name: 'Lugar B' }),
        ]),
      });
      await build([src]);

      const run = await runner.runSource('tripadvisor');

      expect(src.fetch).toHaveBeenCalledTimes(1);
      expect(enrichment.enrich).toHaveBeenCalledTimes(2);
      expect(quality.score).toHaveBeenCalledTimes(2);

      expect(run.source_id).toBe('tripadvisor');
      expect(run.items_found).toBe(2);
      expect(run.items_enriched).toBe(2);
      expect(run.items_failed).toBe(0);
      expect(run.errored).toBe(false);
      expect(run.duration_ms).toBeGreaterThanOrEqual(0);
      expect(typeof run.started_at).toBe('string');
      expect(typeof run.finished_at).toBe('string');
    });

    it('tira NotFoundException si el sourceId no existe', async () => {
      await build([mockSource({ id: 'a' })]);
      await expect(runner.runSource('does-not-exist')).rejects.toThrow(NotFoundException);
    });

    it('no corre una source con enabled=false aunque se la pidan por id', async () => {
      const src = mockSource({ id: 'disabled-src', enabled: false });
      await build([src]);
      await expect(runner.runSource('disabled-src')).rejects.toThrow();
      expect(src.fetch).not.toHaveBeenCalled();
    });
  });

  // ── runSource — error handling en fetch ─────────────────────────────

  describe('runSource — fetch fallido', () => {
    it('captura el error de fetch y devuelve summary con errored=true', async () => {
      const src = mockSource({
        id: 'broken',
        fetch: jest.fn().mockRejectedValue(new Error('API down')),
      });
      await build([src]);

      const run = await runner.runSource('broken');

      expect(run.errored).toBe(true);
      expect(run.error_message).toContain('API down');
      expect(run.items_found).toBe(0);
      expect(run.items_enriched).toBe(0);
      expect(enrichment.enrich).not.toHaveBeenCalled();
    });

    it('no propaga el error — siempre devuelve un summary', async () => {
      const src = mockSource({
        id: 'broken-2',
        fetch: jest.fn().mockRejectedValue(new Error('timeout')),
      });
      await build([src]);

      await expect(runner.runSource('broken-2')).resolves.toMatchObject({
        source_id: 'broken-2',
        errored: true,
      });
    });
  });

  // ── runSource — conteo de items_found/enriched/failed ────────────────

  describe('runSource — conteo de metricas', () => {
    it('cuenta correctamente cuando algunos items fallan en enrichment', async () => {
      const src = mockSource({
        id: 'mixed',
        fetch: jest.fn().mockResolvedValue([
          rawItem({ external_id: '1' }),
          rawItem({ external_id: '2' }),
          rawItem({ external_id: '3' }),
        ]),
      });
      await build([src]);

      // Item 2 falla enrichment (tira excepcion), item 3 devuelve null
      enrichment.enrich.mockImplementation(async (item: RawItem) => {
        if (item.external_id === '2') throw new Error('geocoding failed');
        if (item.external_id === '3') return null;
        return enrichedFrom(item);
      });

      const run = await runner.runSource('mixed');

      expect(run.items_found).toBe(3);
      expect(run.items_enriched).toBe(1);
      expect(run.items_failed).toBe(2);
      expect(run.errored).toBe(false); // fetch funciono, solo fallaron items individuales
    });

    it('cuenta items_persisted vs items_deduped segun quality threshold', async () => {
      const src = mockSource({
        id: 'q',
        fetch: jest.fn().mockResolvedValue([
          rawItem({ external_id: 'hi' }),
          rawItem({ external_id: 'lo' }),
        ]),
      });
      await build([src]);

      enrichment.enrich.mockImplementation(async (i: RawItem) =>
        enrichedFrom(i, i.external_id === 'hi' ? 0.9 : 0.2),
      );

      const run = await runner.runSource('q');

      expect(run.items_enriched).toBe(2);
      // Solo el item con score 0.9 deberia persistirse
      expect(run.items_persisted).toBe(1);
      expect(quality.score).toHaveBeenCalledTimes(2);
    });

    it('items_found=0 cuando fetch devuelve array vacio (no es error)', async () => {
      const src = mockSource({
        id: 'empty',
        fetch: jest.fn().mockResolvedValue([]),
      });
      await build([src]);

      const run = await runner.runSource('empty');

      expect(run.items_found).toBe(0);
      expect(run.items_enriched).toBe(0);
      expect(run.items_failed).toBe(0);
      expect(run.errored).toBe(false);
      expect(enrichment.enrich).not.toHaveBeenCalled();
    });
  });

  // ── runAll ──────────────────────────────────────────────────────────

  describe('runAll', () => {
    it('itera sobre todas las sources con enabled=true', async () => {
      const a = mockSource({ id: 'a', fetch: jest.fn().mockResolvedValue([rawItem({ external_id: 'a1' })]) });
      const b = mockSource({ id: 'b', fetch: jest.fn().mockResolvedValue([rawItem({ external_id: 'b1' })]) });
      await build([a, b]);

      const runs = await runner.runAll();

      expect(runs).toHaveLength(2);
      expect(runs.map((r) => r.source_id).sort()).toEqual(['a', 'b']);
      expect(a.fetch).toHaveBeenCalledTimes(1);
      expect(b.fetch).toHaveBeenCalledTimes(1);
    });

    it('saltea las sources con enabled=false', async () => {
      const on = mockSource({ id: 'on', enabled: true });
      const off = mockSource({ id: 'off', enabled: false });
      await build([on, off]);

      const runs = await runner.runAll();

      expect(runs).toHaveLength(1);
      expect(runs[0].source_id).toBe('on');
      expect(off.fetch).not.toHaveBeenCalled();
    });

    it('una source que falla NO detiene a las demas', async () => {
      const ok = mockSource({ id: 'ok', fetch: jest.fn().mockResolvedValue([]) });
      const bad = mockSource({ id: 'bad', fetch: jest.fn().mockRejectedValue(new Error('boom')) });
      await build([ok, bad]);

      const runs = await runner.runAll();

      expect(runs).toHaveLength(2);
      const badRun = runs.find((r) => r.source_id === 'bad')!;
      const okRun = runs.find((r) => r.source_id === 'ok')!;
      expect(badRun.errored).toBe(true);
      expect(okRun.errored).toBe(false);
    });

    it('devuelve array vacio si no hay sources registradas', async () => {
      await build([]);
      const runs = await runner.runAll();
      expect(runs).toEqual([]);
    });
  });
});
