import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { PlacesService } from './places.service';
import { PlaceSortBy } from './dto/place-list-query.dto';
import { TravelerType } from '../preferences/dto/create-preferences.dto';

// ── Supabase mock ───────────────────────────────────────────────
// Creates a thenable chain so `await supabase.from(...).select(...)...` works
interface MockDbError {
  message: string;
  code?: string;
}

interface MockDbResult {
  data: unknown;
  error: MockDbError | null;
  count: number | null;
}

type ChainMethod = jest.MockedFunction<(...args: unknown[]) => MockChain>;
type RpcMethod = jest.MockedFunction<
  (...args: unknown[]) => Promise<MockDbResult>
>;

interface MockChain extends PromiseLike<MockDbResult> {
  from: ChainMethod;
  select: ChainMethod;
  insert: ChainMethod;
  update: ChainMethod;
  delete: ChainMethod;
  eq: ChainMethod;
  neq: ChainMethod;
  ilike: ChainMethod;
  in: ChainMethod;
  not: ChainMethod;
  order: ChainMethod;
  range: ChainMethod;
  single: ChainMethod;
  maybeSingle: ChainMethod;
  textSearch: ChainMethod;
  contains: ChainMethod;
}

interface MockSupabase {
  from: ChainMethod;
  rpc: RpcMethod;
  auth: Record<string, never>;
  _on: (data: unknown, error?: MockDbError | null, count?: number) => MockChain;
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
    'ilike',
    'in',
    'not',
    'order',
    'range',
    'single',
    'maybeSingle',
    'textSearch',
    'contains',
  ] satisfies Array<keyof Omit<MockChain, 'then'>>;

  for (const method of methods) {
    chain[method] = jest
      .fn<(...args: unknown[]) => MockChain>()
      .mockReturnValue(chain);
  }

  // Make the chain awaitable
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
  // Root object — NO .then() so NestJS doesn't unwrap it
  const mock: MockSupabase = {
    from: jest.fn<(...args: unknown[]) => MockChain>(),
    rpc: jest.fn<(...args: unknown[]) => Promise<MockDbResult>>(),
    auth: {},
    _on: (data: unknown, error?: MockDbError | null, count?: number) => {
      const c = createChain({
        data,
        error: error ?? null,
        count: count ?? null,
      });
      mock.from.mockReturnValueOnce(c);
      return c;
    },
  };
  // Default .from() returns an empty-result chain
  mock.from.mockImplementation(() =>
    createChain({ data: null, error: null, count: null }),
  );
  mock.rpc.mockImplementation(() =>
    Promise.resolve({ data: null, error: null, count: null }),
  );
  return mock;
}

describe('PlacesService', () => {
  let service: PlacesService;
  let supabase: MockSupabase;

  beforeEach(async () => {
    supabase = createMockSupabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacesService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('https://xitty.co') },
        },
      ],
    }).compile();

    service = module.get<PlacesService>(PlacesService);
  });

  // ── Categorias ──────────────────────────────────────────────────

  describe('findAllCategories', () => {
    it('devuelve todas las categorias ordenadas', async () => {
      const cats = [
        {
          id: '1',
          name: 'Bares',
          slug: 'bares-vida-nocturna',
          icon: 'glass-cheers',
        },
        {
          id: '2',
          name: 'Restaurantes',
          slug: 'restaurantes',
          icon: 'utensils',
        },
      ];
      supabase._on(cats);

      const result = await service.findAllCategories();
      expect(result).toEqual(cats);
    });
  });

  // ── Listado paginado ────────────────────────────────────────────

  describe('findAll', () => {
    it('devuelve lista paginada con cover photos', async () => {
      const places = [
        { id: 'p1', name: 'La Trattoria', average_rating: 4.5 },
        { id: 'p2', name: 'El Muelle', average_rating: 3.8 },
      ];
      supabase._on(places, null, 25); // places query
      supabase._on([{ place_id: 'p1', url: 'https://photo.jpg' }]); // covers

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].cover_photo_url).toBe('https://photo.jpg');
      expect(result.data[1].cover_photo_url).toBeNull();
    });

    it('requiere lat/lng cuando sort_by es distance', async () => {
      await expect(
        service.findAll({ sort_by: PlaceSortBy.DISTANCE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('filtra por categoria', async () => {
      const chain = supabase._on([], null, 0);
      await service.findAll({ page: 1, limit: 10, category_id: 'cat-uuid' });
      expect(chain.eq).toHaveBeenCalledWith('category_id', 'cat-uuid');
    });

    // ── traveler_type filter ─────────────────────────────────────
    it('acepta traveler_type opcional y filtra por tag matching', async () => {
      const chain = supabase._on(
        [{ id: 'p1', name: 'Parque Familiar', tags: ['familia'] }],
        null,
        1,
      );

      await service.findAll({
        page: 1,
        limit: 10,
        traveler_type: TravelerType.FAMILIA,
      });

      expect(chain.contains).toHaveBeenCalledWith('tags', ['familia']);
    });

    it('no aplica filtro contains cuando traveler_type no se pasa (regresion)', async () => {
      const chain = supabase._on([], null, 0);
      await service.findAll({ page: 1, limit: 10 });
      expect(chain.contains).not.toHaveBeenCalled();
    });

    it('combina traveler_type con otros filtros (category_id)', async () => {
      const chain = supabase._on([], null, 0);
      await service.findAll({
        page: 1,
        limit: 10,
        category_id: 'cat-uuid',
        traveler_type: TravelerType.PAREJA,
      });
      expect(chain.eq).toHaveBeenCalledWith('category_id', 'cat-uuid');
      expect(chain.contains).toHaveBeenCalledWith('tags', ['pareja']);
    });
  });

  // ── Busqueda ────────────────────────────────────────────────────

  describe('search', () => {
    it('usa full-text search en espanol', async () => {
      const chain = supabase._on([{ id: 'p1', name: 'El Caribe' }], null, 1);

      const result = await service.search('caribe', 1, 10);

      expect(chain.textSearch).toHaveBeenCalledWith('search_vector', 'caribe', {
        type: 'websearch',
        config: 'spanish',
      });
      expect(result.data).toHaveLength(1);
    });
  });

  // ── Detalle ─────────────────────────────────────────────────────

  describe('findById', () => {
    it('devuelve lugar con fotos', async () => {
      supabase._on({ id: 'p1', name: 'La Trattoria' }); // place
      supabase._on([{ id: 'ph1', url: 'https://photo.jpg' }]); // photos

      const result = await service.findById('p1');
      expect(result.name).toBe('La Trattoria');
      expect(result.photos).toHaveLength(1);
    });

    it('lanza 404 si no existe', async () => {
      supabase._on(null, { message: 'not found' });
      await expect(service.findById('x')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Crear ───────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { name: 'Nuevo Restaurante' };

    it('business owner puede crear', async () => {
      supabase._on({ id: 'new-1', ...dto, owner_id: 'u1' });
      const result = await service.create('u1', 'business', dto);
      expect(result.id).toBe('new-1');
      expect(result.photos).toEqual([]);
    });

    it('admin puede crear', async () => {
      supabase._on({ id: 'new-2', ...dto });
      const result = await service.create('a1', 'admin', dto);
      expect(result.id).toBe('new-2');
    });

    it('usuario normal no puede crear', async () => {
      await expect(service.create('u1', 'user', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── Actualizar ──────────────────────────────────────────────────

  describe('update', () => {
    it('owner puede actualizar', async () => {
      supabase._on({ owner_id: 'u1' }); // fetch
      supabase._on({ id: 'p1', name: 'X' }); // update
      supabase._on([]); // photos

      const result = await service.update('p1', 'u1', 'business', {
        name: 'X',
      });
      expect(result.name).toBe('X');
    });

    it('no-owner no puede actualizar', async () => {
      supabase._on({ owner_id: 'u1' });
      await expect(
        service.update('p1', 'otro', 'user', { name: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('solo admin puede cambiar is_active', async () => {
      supabase._on({ owner_id: 'u1' });
      await expect(
        service.update('p1', 'u1', 'business', { is_active: false }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Soft delete ─────────────────────────────────────────────────

  describe('softDelete', () => {
    it('admin puede desactivar', async () => {
      supabase._on(null);
      await expect(service.softDelete('p1', 'admin')).resolves.toBeUndefined();
    });

    it('usuario normal no puede', async () => {
      await expect(service.softDelete('p1', 'user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── Open Graph ──────────────────────────────────────────────────

  describe('getOgMetadata', () => {
    it('devuelve metadata para compartir', async () => {
      supabase._on({
        id: 'p1',
        name: 'La Trattoria',
        description: 'Italiano',
        average_rating: 4.5,
      });
      supabase._on({ url: 'https://photo.jpg' });

      const result = await service.getOgMetadata('p1');
      expect(result.title).toBe('La Trattoria');
      expect(result.image).toBe('https://photo.jpg');
      expect(result.url).toBe('https://xitty.co/places/p1');
      expect(result.site_name).toBe('Xitty');
      expect(result.rating).toBe(4.5);
    });
  });
});
