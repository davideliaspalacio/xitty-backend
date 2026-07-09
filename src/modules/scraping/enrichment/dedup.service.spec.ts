import type { SupabaseClient } from '@supabase/supabase-js';

import { DedupDuplicate, DedupService } from './dedup.service';
import type { LlmEnrichedItem } from './schema/enriched-item.schema';

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
  rpc: jest.MockedFunction<(...args: unknown[]) => unknown>;
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
    rpc: jest.fn<(...args: unknown[]) => unknown>(),
    _on: (data: unknown, error?: MockDbError) => {
      const c = createChain({ data, error: error ?? null });
      mock.from.mockReturnValueOnce(c);
      return c;
    },
  };
  mock.from.mockImplementation(() => createChain({ data: null, error: null }));
  return mock;
}

function item(overrides: Partial<LlmEnrichedItem> = {}): LlmEnrichedItem {
  return {
    title: 'Carnaval de Barranquilla',
    description: null,
    category_hint: null,
    location_name: 'Vía 40',
    lat: null,
    lng: null,
    starts_at: '2026-02-20T08:00:00Z',
    ends_at: null,
    price_cop: null,
    ...overrides,
  };
}

describe('DedupService', () => {
  let service: DedupService;
  let supabase: MockSupabase;

  beforeEach(() => {
    supabase = createMockSupabase();
    service = new DedupService(supabase as unknown as SupabaseClient);
  });

  describe('computeHash', () => {
    it('produce un hash SHA-256 de 64 chars hex', () => {
      const h = service.computeHash(item());
      expect(h).toMatch(/^[a-f0-9]{64}$/);
    });

    it('es deterministico: mismo input → mismo hash', () => {
      const h1 = service.computeHash(item());
      const h2 = service.computeHash(item());
      expect(h1).toBe(h2);
    });

    it('normaliza title: case insensitive', () => {
      const h1 = service.computeHash(
        item({ title: 'CARNAVAL DE BARRANQUILLA' }),
      );
      const h2 = service.computeHash(
        item({ title: 'carnaval de barranquilla' }),
      );
      expect(h1).toBe(h2);
    });

    it('normaliza title: trimea whitespace', () => {
      const h1 = service.computeHash(
        item({ title: '  Carnaval de Barranquilla  ' }),
      );
      const h2 = service.computeHash(
        item({ title: 'Carnaval de Barranquilla' }),
      );
      expect(h1).toBe(h2);
    });

    it('normaliza title: colapsa whitespace interno', () => {
      const h1 = service.computeHash(
        item({ title: 'Carnaval  de   Barranquilla' }),
      );
      const h2 = service.computeHash(
        item({ title: 'Carnaval de Barranquilla' }),
      );
      expect(h1).toBe(h2);
    });

    it('normaliza title: remueve diacriticos (acentos)', () => {
      const h1 = service.computeHash(item({ title: 'Río Magdalena' }));
      const h2 = service.computeHash(item({ title: 'Rio Magdalena' }));
      expect(h1).toBe(h2);
    });

    it('normaliza location_name igual que title', () => {
      const h1 = service.computeHash(item({ location_name: 'VÍA 40' }));
      const h2 = service.computeHash(item({ location_name: 'via 40' }));
      expect(h1).toBe(h2);
    });

    it('cambia hash si cambia title', () => {
      const h1 = service.computeHash(item({ title: 'Carnaval' }));
      const h2 = service.computeHash(item({ title: 'Joselito Carnaval' }));
      expect(h1).not.toBe(h2);
    });

    it('cambia hash si cambia location', () => {
      const h1 = service.computeHash(item({ location_name: 'Vía 40' }));
      const h2 = service.computeHash(
        item({ location_name: 'Plaza de la Paz' }),
      );
      expect(h1).not.toBe(h2);
    });

    it('cambia hash si cambia fecha', () => {
      const h1 = service.computeHash(
        item({ starts_at: '2026-02-20T08:00:00Z' }),
      );
      const h2 = service.computeHash(
        item({ starts_at: '2027-02-20T08:00:00Z' }),
      );
      expect(h1).not.toBe(h2);
    });

    it('trata null/undefined/empty igual en location y fecha', () => {
      const h1 = service.computeHash(
        item({ location_name: null, starts_at: null }),
      );
      const h2 = service.computeHash(
        item({ location_name: undefined, starts_at: undefined }),
      );
      const h3 = service.computeHash(
        item({ location_name: '', starts_at: '' }),
      );
      expect(h1).toBe(h2);
      expect(h2).toBe(h3);
    });
  });

  describe('findDuplicate', () => {
    it('retorna null cuando no hay match en scraped_items_raw', async () => {
      supabase._on(null);

      const result = await service.findDuplicate('abc123');

      expect(result).toBeNull();
      expect(supabase.from.mock.calls[0]).toEqual(['scraped_items_raw']);
    });

    it('retorna el row cuando hay match por raw_hash', async () => {
      const existing: DedupDuplicate = {
        id: 'r1',
        raw_hash: 'abc123',
        source_kind: 'instagram',
      };
      supabase._on(existing);

      const result = await service.findDuplicate('abc123');

      expect(result).toEqual(existing);
    });

    it('si supabase devuelve error, lo loguea y retorna null (best-effort)', async () => {
      supabase._on(null, { message: 'db down' });

      const result = await service.findDuplicate('abc123');

      expect(result).toBeNull();
    });

    it('usa maybeSingle para no fallar si hay 0 rows', async () => {
      const chain = supabase._on(null);

      await service.findDuplicate('abc');

      expect(chain.maybeSingle).toHaveBeenCalled();
    });
  });
});
