import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FeaturedService } from './featured.service';

function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from',
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'order',
    'range',
    'single',
    'maybeSingle',
    'limit',
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

describe('FeaturedService', () => {
  let service: FeaturedService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeaturedService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get<FeaturedService>(FeaturedService);
  });

  // ── Lectura publica ─────────────────────────────────────────────

  describe('findCurrent', () => {
    it('devuelve los destacados activos esta semana con datos del place', async () => {
      supabase._on([
        {
          id: 'f1',
          place_id: 'p1',
          curator_name: 'Equipo Xitty',
          custom_title: null,
          custom_description: null,
          hero_image_url: null,
          week_starts_at: '2026-04-27T00:00:00Z',
          week_ends_at: '2026-05-03T23:59:59Z',
          position: 0,
          is_active: true,
          created_by: 'admin-1',
          created_at: '2026-04-26T10:00:00Z',
          updated_at: '2026-04-26T10:00:00Z',
          places: {
            id: 'p1',
            name: 'Trattoria Anna',
            slug: 'trattoria-anna',
            description: null,
            address: null,
            category_id: 'c1',
            average_rating: 4.6,
            total_reviews: 120,
            place_photos: [
              {
                url: 'https://img/cover.jpg',
                is_cover: true,
                display_order: 0,
              },
            ],
          },
        },
      ]);

      const result = await service.findCurrent();
      expect(result).toHaveLength(1);
      expect(result[0].curator_name).toBe('Equipo Xitty');
      expect(result[0].place?.cover_photo_url).toBe('https://img/cover.jpg');
    });

    it('devuelve array vacio cuando no hay destacados', async () => {
      supabase._on([]);
      supabase._on([]);
      const result = await service.findCurrent();
      expect(result).toEqual([]);
    });

    it('usa fallback de lugares activos cuando no hay destacados vigentes', async () => {
      supabase._on([]);
      supabase._on([
        {
          id: 'p1',
          name: 'Castillo de Salgar',
          slug: 'castillo-de-salgar',
          description: null,
          address: null,
          category_id: 'c1',
          average_rating: 4.8,
          total_reviews: 120,
          place_photos: [
            {
              url: 'https://img/salgar.jpg',
              is_cover: true,
              display_order: 0,
            },
          ],
        },
      ]);

      const result = await service.findCurrent();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('fallback-p1');
      expect(result[0].curator_name).toBe('Xitty');
      expect(result[0].custom_description).toMatch(/Recomendado/);
      expect(result[0].place?.cover_photo_url).toBe('https://img/salgar.jpg');
    });
  });

  describe('findAll', () => {
    it('devuelve historial paginado con total', async () => {
      supabase._on(
        [
          {
            id: 'f1',
            place_id: 'p1',
            curator_name: '@andrea',
            custom_title: null,
            custom_description: null,
            hero_image_url: null,
            week_starts_at: '2026-04-20T00:00:00Z',
            week_ends_at: '2026-04-26T23:59:59Z',
            position: 0,
            is_active: true,
            created_by: 'admin-1',
            created_at: '2026-04-19T00:00:00Z',
            updated_at: '2026-04-19T00:00:00Z',
            places: null,
          },
        ],
        null,
        1,
      );

      const result = await service.findAll(1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  // ── Crear ───────────────────────────────────────────────────────

  describe('create', () => {
    const validDto = {
      place_id: 'place-1',
      curator_name: '@andrea',
      week_starts_at: '2026-04-27T00:00:00Z',
      week_ends_at: '2026-05-03T23:59:59Z',
    };

    it('admin puede crear un destacado para un place activo', async () => {
      supabase._on({ id: 'place-1', is_active: true }); // place check
      supabase._on({
        // insert result
        id: 'f-new',
        place_id: 'place-1',
        curator_name: '@andrea',
        custom_title: null,
        custom_description: null,
        hero_image_url: null,
        week_starts_at: validDto.week_starts_at,
        week_ends_at: validDto.week_ends_at,
        position: 0,
        is_active: true,
        created_by: 'admin-1',
        created_at: '2026-04-26T10:00:00Z',
        updated_at: '2026-04-26T10:00:00Z',
        places: null,
      });

      const result = await service.create('admin-1', 'admin', validDto);
      expect(result.id).toBe('f-new');
      expect(result.curator_name).toBe('@andrea');
    });

    it('rechaza a quien no es admin', async () => {
      await expect(
        service.create('user-1', 'business', validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza si week_ends_at <= week_starts_at', async () => {
      await expect(
        service.create('admin-1', 'admin', {
          ...validDto,
          week_starts_at: '2026-04-27T00:00:00Z',
          week_ends_at: '2026-04-26T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza 404 si el place no existe', async () => {
      supabase._on(null);
      await expect(
        service.create('admin-1', 'admin', validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza featurear un place inactivo', async () => {
      supabase._on({ id: 'place-1', is_active: false });
      await expect(
        service.create('admin-1', 'admin', validDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Actualizar ──────────────────────────────────────────────────

  describe('update', () => {
    it('admin puede editar el curator_name', async () => {
      supabase._on({
        id: 'f1',
        place_id: 'p1',
        curator_name: '@nuevo-influencer',
        custom_title: null,
        custom_description: null,
        hero_image_url: null,
        week_starts_at: '2026-04-27T00:00:00Z',
        week_ends_at: '2026-05-03T23:59:59Z',
        position: 0,
        is_active: true,
        created_by: 'admin-1',
        created_at: '2026-04-26T00:00:00Z',
        updated_at: '2026-04-26T12:00:00Z',
        places: null,
      });

      const result = await service.update('f1', 'admin', {
        curator_name: '@nuevo-influencer',
      });
      expect(result.curator_name).toBe('@nuevo-influencer');
    });

    it('requiere al menos un campo', async () => {
      await expect(service.update('f1', 'admin', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza 404 si no existe', async () => {
      supabase._on(null, null);
      await expect(
        service.update('missing', 'admin', { is_active: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza a quien no es admin', async () => {
      await expect(
        service.update('f1', 'business', { is_active: false }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Eliminar ────────────────────────────────────────────────────

  describe('remove', () => {
    it('admin puede eliminar un destacado', async () => {
      supabase._on(null);
      await expect(service.remove('f1', 'admin')).resolves.toBeUndefined();
    });

    it('rechaza a quien no es admin', async () => {
      await expect(service.remove('f1', 'business')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
