import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete',
    'eq', 'order', 'range', 'single', 'maybeSingle',
  ];
  methods.forEach((m) => (chain[m] = jest.fn().mockReturnValue(chain)));
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createMockSupabase() {
  const mock: any = { from: jest.fn() };
  mock._on = (data: any, error?: any, count?: number) => {
    const c = createChain({ data, error: error || null, count: count ?? null });
    mock.from.mockReturnValueOnce(c);
    return c;
  };
  mock.from.mockImplementation(() =>
    createChain({ data: null, error: null, count: null }),
  );
  return mock;
}

describe('ReviewsService', () => {
  let service: ReviewsService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get<ReviewsService>(ReviewsService);
  });

  describe('findByPlaceId', () => {
    it('devuelve resenas paginadas con perfil del usuario', async () => {
      const reviews = [
        { id: 'r1', rating: 5, comment: 'Excelente!', profiles: { full_name: 'Juan' } },
        { id: 'r2', rating: 3, comment: 'Regular', profiles: { full_name: 'Maria' } },
      ];
      supabase._on(reviews, null, 2);

      const result = await service.findByPlaceId('place-1', 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('create', () => {
    it('turista deja resena en lugar activo', async () => {
      supabase._on({ id: 'place-1' }); // place exists
      supabase._on({ id: 'r1', place_id: 'place-1', user_id: 'u1', rating: 4, comment: 'Bueno' });

      const result = await service.create('place-1', 'u1', { rating: 4, comment: 'Bueno' });
      expect(result.rating).toBe(4);
    });

    it('lanza 404 si el lugar no existe', async () => {
      supabase._on(null);
      await expect(service.create('x', 'u1', { rating: 5 })).rejects.toThrow(NotFoundException);
    });

    it('lanza 409 si ya reseno (una por usuario por lugar)', async () => {
      supabase._on({ id: 'place-1' });
      supabase._on(null, { code: '23505', message: 'duplicate' });
      await expect(service.create('place-1', 'u1', { rating: 3 })).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('usuario edita su resena', async () => {
      supabase._on({ id: 'r1', rating: 5, comment: 'Mejor' });
      const result = await service.update('place-1', 'u1', { rating: 5, comment: 'Mejor' });
      expect(result.rating).toBe(5);
    });

    it('lanza 404 si la resena no existe', async () => {
      supabase._on(null);
      await expect(service.update('p1', 'u1', { rating: 2 })).rejects.toThrow(NotFoundException);
    });

    it('requiere al menos un campo', async () => {
      await expect(service.update('p1', 'u1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('usuario elimina su resena', async () => {
      supabase._on(null);
      await expect(service.remove('place-1', 'u1')).resolves.toBeUndefined();
    });
  });
});
