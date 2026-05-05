import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LocalPicksService } from './local-picks.service';

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

describe('LocalPicksService', () => {
  let service: LocalPicksService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalPicksService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get<LocalPicksService>(LocalPicksService);
  });

  describe('findCurrent', () => {
    it('devuelve picks activos esta semana con datos del place', async () => {
      supabase._on([
        {
          id: 'lp1', place_id: 'p1', curator_name: '@andrea',
          pick_tag: 'secreto', short_pitch: 'lo mejor',
          hero_image_url: null,
          week_starts_at: '2026-05-04T00:00:00Z',
          week_ends_at: '2026-05-10T23:59:59Z',
          position: 0, is_active: true,
          created_by: 'admin-1',
          created_at: 'now', updated_at: 'now',
          places: {
            id: 'p1', name: 'Joya escondida', slug: 'joya', description: null, address: null,
            category_id: 'c1', average_rating: 4.8, total_reviews: 12,
            place_photos: [{ url: 'https://img/cover.jpg', is_cover: true, display_order: 0 }],
          },
        },
      ]);
      const result = await service.findCurrent();
      expect(result).toHaveLength(1);
      expect(result[0].pick_tag).toBe('secreto');
      expect(result[0].place?.cover_photo_url).toBe('https://img/cover.jpg');
    });

    it('filtra por tag cuando se pasa', async () => {
      supabase._on([]);
      const result = await service.findCurrent('favorito_local');
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const dto = {
      place_id: 'p1',
      curator_name: '@andrea',
      pick_tag: 'secreto' as any,
      week_starts_at: '2026-05-04T00:00:00Z',
      week_ends_at: '2026-05-10T23:59:59Z',
    };

    it('admin puede crear', async () => {
      supabase._on({ id: 'p1', is_active: true });
      supabase._on({
        id: 'lp-new', place_id: 'p1', curator_name: '@andrea', pick_tag: 'secreto',
        short_pitch: null, hero_image_url: null,
        week_starts_at: dto.week_starts_at, week_ends_at: dto.week_ends_at,
        position: 0, is_active: true, created_by: 'admin-1',
        created_at: 'now', updated_at: 'now', places: null,
      });
      const result = await service.create('admin-1', 'admin', dto);
      expect(result.id).toBe('lp-new');
    });

    it('rechaza non-admin', async () => {
      await expect(service.create('u1', 'business', dto)).rejects.toThrow(ForbiddenException);
    });

    it('rechaza place inactivo', async () => {
      supabase._on({ id: 'p1', is_active: false });
      await expect(service.create('admin-1', 'admin', dto)).rejects.toThrow(BadRequestException);
    });

    it('rechaza si place no existe', async () => {
      supabase._on(null);
      await expect(service.create('admin-1', 'admin', dto)).rejects.toThrow(NotFoundException);
    });

    it('rechaza ventana invertida', async () => {
      await expect(
        service.create('admin-1', 'admin', {
          ...dto,
          week_starts_at: '2026-05-10T00:00:00Z',
          week_ends_at: '2026-05-04T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('requiere al menos un campo', async () => {
      await expect(service.update('lp1', 'admin', {})).rejects.toThrow(BadRequestException);
    });

    it('rechaza non-admin', async () => {
      await expect(
        service.update('lp1', 'business', { is_active: false }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('admin puede eliminar', async () => {
      supabase._on(null);
      await expect(service.remove('lp1', 'admin')).resolves.toBeUndefined();
    });

    it('rechaza non-admin', async () => {
      await expect(service.remove('lp1', 'business')).rejects.toThrow(ForbiddenException);
    });
  });
});
