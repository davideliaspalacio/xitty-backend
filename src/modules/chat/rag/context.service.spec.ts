import { Test, TestingModule } from '@nestjs/testing';
import { ContextService } from './context.service';

function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'eq', 'in', 'order', 'limit',
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

describe('ContextService', () => {
  let service: ContextService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
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
      expect(service.extractEntities('donde puedo comer rico'))
        .toContain('restaurantes');
    });

    it('encuentra slug "restaurantes" para keyword restaurante', () => {
      expect(service.extractEntities('busco un buen restaurante italiano'))
        .toContain('restaurantes');
    });

    it('encuentra "bares-vida-nocturna" para keyword bar', () => {
      expect(service.extractEntities('cual es el mejor bar para la noche'))
        .toContain('bares-vida-nocturna');
    });

    it('encuentra "hoteles" para keyword hotel', () => {
      expect(service.extractEntities('necesito un hotel cerca del centro'))
        .toContain('hoteles');
    });

    it('encuentra "cultura" para museo', () => {
      expect(service.extractEntities('me gustan los museos de la ciudad'))
        .toContain('cultura');
    });

    it('encuentra "experiencias" para tour', () => {
      expect(service.extractEntities('busco un tour del centro')).toContain('experiencias');
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
      const result = service.extractEntities('quiero ir a la playa y luego comer');
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
