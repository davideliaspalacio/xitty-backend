import { Test, TestingModule } from '@nestjs/testing';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ContextService } from './context.service';

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
  eq: ChainMethod;
  in: ChainMethod;
  order: ChainMethod;
  limit: ChainMethod;
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
    'eq',
    'in',
    'order',
    'limit',
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

describe('ContextService', () => {
  let service: ContextService;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
      ],
    }).compile();
    service = module.get<ContextService>(ContextService);
  });

  describe('extractEntities', () => {
    it('encuentra slug "playas" cuando el texto menciona playa', () => {
      const result = service.extractEntities('Quiero ir a la playa hoy');
      expect(result).toContain('playas');
    });

    it('encuentra slug "restaurantes" cuando se menciona comida', () => {
      expect(service.extractEntities('donde puedo comer rico')).toContain(
        'restaurantes',
      );
    });

    it('encuentra slug "restaurantes" para keyword restaurante', () => {
      expect(
        service.extractEntities('busco un buen restaurante italiano'),
      ).toContain('restaurantes');
    });

    it('encuentra "bares-vida-nocturna" para keyword bar', () => {
      expect(
        service.extractEntities('cual es el mejor bar para la noche'),
      ).toContain('bares-vida-nocturna');
    });

    it('encuentra "hoteles" para keyword hotel', () => {
      expect(
        service.extractEntities('necesito un hotel cerca del centro'),
      ).toContain('hoteles');
    });

    it('encuentra "cultura" para museo', () => {
      expect(
        service.extractEntities('me gustan los museos de la ciudad'),
      ).toContain('cultura');
    });

    it('encuentra "experiencias" para tour', () => {
      expect(service.extractEntities('busco un tour del centro')).toContain(
        'experiencias',
      );
    });

    it('retorna [] para query muy generica sin keywords', () => {
      const result = service.extractEntities('hola que tal todo');
      expect(result).toEqual([]);
    });

    it('retorna [] para string vacio', () => {
      expect(service.extractEntities('')).toEqual([]);
    });

    it('no produce duplicados si dos keywords mapean al mismo slug', () => {
      const result = service.extractEntities('restaurante y comida rica');
      const occurrences = result.filter((s) => s === 'restaurantes').length;
      expect(occurrences).toBe(1);
    });

    it('detecta multiples categorias en un solo mensaje', () => {
      const result = service.extractEntities(
        'quiero ir a la playa y luego comer',
      );
      expect(result).toContain('playas');
      expect(result).toContain('restaurantes');
    });

    it('es case insensitive', () => {
      expect(service.extractEntities('PLAYA hoy')).toContain('playas');
    });
  });

  describe('getSnippetsFor', () => {
    it('retorna places ordenados por average_rating cuando keyword matchea', async () => {
      // 1) categories lookup
      supabase._on([{ id: 'cat-playa', slug: 'playas', name: 'Playas' }]);
      // 2) places lookup
      supabase._on([
        {
          id: 'p1',
          name: 'Playa Salgar',
          description: 'Bonita',
          address: 'Pto Colombia',
          category_id: 'cat-playa',
          average_rating: 4.5,
          price_range: 2,
        },
        {
          id: 'p2',
          name: 'Playa Pradomar',
          description: null,
          address: null,
          category_id: 'cat-playa',
          average_rating: 4.2,
          price_range: 1,
        },
      ]);

      const result = await service.getSnippetsFor('quiero ir a la playa');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('p1');
      expect(result[0].name).toBe('Playa Salgar');
      expect(result[0].category).toBe('Playas');
      expect(result[0].average_rating).toBe(4.5);
      expect(result[1].id).toBe('p2');
    });

    it('retorna [] si el texto no tiene keywords', async () => {
      const result = await service.getSnippetsFor('hola que tal');
      expect(result).toEqual([]);
      // supabase no debe haberse llamado en este caso
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('retorna [] si las categorias no existen', async () => {
      supabase._on([]); // no categories
      const result = await service.getSnippetsFor('quiero playa');
      expect(result).toEqual([]);
    });

    it('retorna [] silenciosamente si supabase tira error en places', async () => {
      supabase._on([{ id: 'cat-playa', slug: 'playas', name: 'Playas' }]);
      supabase._on(null, { message: 'db down' });
      const result = await service.getSnippetsFor('playa');
      expect(result).toEqual([]);
    });
  });
});
