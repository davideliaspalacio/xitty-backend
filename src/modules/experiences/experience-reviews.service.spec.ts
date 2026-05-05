import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ExperienceReviewsService } from './experience-reviews.service';

function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete',
    'eq', 'in', 'order', 'range', 'single', 'maybeSingle',
  ];
  methods.forEach((m) => (chain[m] = jest.fn().mockReturnValue(chain)));
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createMockSupabase() {
  const mock: any = { from: jest.fn(), rpc: jest.fn() };
  mock._on = (data: any, error?: any, count?: number) => {
    const c = createChain({ data, error: error || null, count: count ?? null });
    mock.from.mockReturnValueOnce(c);
    return c;
  };
  mock._onRpc = (data: any, error?: any) => {
    mock.rpc.mockReturnValueOnce(Promise.resolve({ data, error: error || null }));
  };
  mock.from.mockImplementation(() =>
    createChain({ data: null, error: null, count: null }),
  );
  mock.rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  return mock;
}

describe('ExperienceReviewsService', () => {
  let service: ExperienceReviewsService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperienceReviewsService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get<ExperienceReviewsService>(ExperienceReviewsService);
  });

  describe('findByExperience', () => {
    it('lista reviews ordenadas por mas recientes con sus fotos', async () => {
      supabase._on(
        [
          { id: 'r1', experience_id: 'e1', user_id: 'u1', rating: 5, comment: 'genial', reservation_id: null, created_at: 'now', updated_at: 'now', author: { id: 'u1', full_name: 'Ana' } },
        ],
        null,
        1,
      );
      supabase._on([
        { id: 'p1', review_id: 'r1', url: 'https://img/1.jpg', display_order: 0 },
        { id: 'p2', review_id: 'r1', url: 'https://img/2.jpg', display_order: 1 },
      ]);
      const result = await service.findByExperience('e1', 1, 10, 'recent');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].photos).toHaveLength(2);
    });
  });

  describe('getRatingDistribution', () => {
    it('calcula distribucion + promedio', async () => {
      supabase._onRpc([
        { rating: 1, count: '0' },
        { rating: 2, count: '0' },
        { rating: 3, count: '1' },
        { rating: 4, count: '2' },
        { rating: 5, count: '7' },
      ]);
      const result = await service.getRatingDistribution('e1');
      expect(result.total).toBe(10);
      expect(result.average).toBeCloseTo(4.6, 1);
    });

    it('promedio 0 cuando no hay reviews', async () => {
      supabase._onRpc([
        { rating: 1, count: '0' }, { rating: 2, count: '0' },
        { rating: 3, count: '0' }, { rating: 4, count: '0' }, { rating: 5, count: '0' },
      ]);
      const result = await service.getRatingDistribution('e1');
      expect(result.total).toBe(0);
      expect(result.average).toBe(0);
    });
  });

  describe('create', () => {
    const dto = { rating: 5, comment: 'top' } as any;

    it('crea la review', async () => {
      supabase._on({ id: 'e1', is_active: true });
      supabase._on({
        id: 'r1', experience_id: 'e1', user_id: 'u1', rating: 5,
        comment: 'top', reservation_id: null,
        created_at: 'now', updated_at: 'now',
        author: { id: 'u1', full_name: 'Ana' },
      });
      const result = await service.create('e1', 'u1', dto);
      expect(result.id).toBe('r1');
      expect(result.photos).toEqual([]);
    });

    it('persiste fotos cuando vienen photo_urls', async () => {
      supabase._on({ id: 'e1', is_active: true });
      supabase._on({
        id: 'r1', experience_id: 'e1', user_id: 'u1', rating: 5,
        comment: 'top', reservation_id: null,
        created_at: 'now', updated_at: 'now',
        author: { id: 'u1', full_name: 'Ana' },
      });
      supabase._on([
        { id: 'p1', url: 'https://img/1.jpg', display_order: 0 },
        { id: 'p2', url: 'https://img/2.jpg', display_order: 1 },
      ]);
      const result = await service.create('e1', 'u1', {
        ...dto,
        photo_urls: ['https://img/1.jpg', 'https://img/2.jpg'],
      });
      expect(result.photos).toHaveLength(2);
    });

    it('lanza 404 si la experience no existe', async () => {
      supabase._on(null);
      await expect(service.create('missing', 'u1', dto)).rejects.toThrow(NotFoundException);
    });

    it('lanza Conflict si ya existe review del mismo usuario', async () => {
      supabase._on({ id: 'e1', is_active: true });
      supabase._on(null, { code: '23505' });
      await expect(service.create('e1', 'u1', dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('requiere al menos un campo', async () => {
      await expect(service.update('e1', 'u1', {})).rejects.toThrow(BadRequestException);
    });
  });
});
