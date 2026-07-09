import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { InteractionType } from './dto/track-interaction.dto';
import { TimeseriesGranularity } from './dto/metrics-timeseries.dto';

function createChain(result: any) {
  const chain: any = {};
  const methods = ['from', 'select', 'insert', 'eq', 'maybeSingle', 'single'];
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
  mock._onRpc = (data: any, error?: any) => {
    mock.rpc.mockReturnValueOnce(
      Promise.resolve({ data, error: error || null }),
    );
  };
  mock.from.mockImplementation(() => createChain({ data: null, error: null }));
  mock.rpc.mockImplementation(() =>
    Promise.resolve({ data: null, error: null }),
  );
  return mock;
}

describe('MetricsService', () => {
  let service: MetricsService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get<MetricsService>(MetricsService);
  });

  // ── Trackear interaccion ────────────────────────────────────────

  describe('track', () => {
    it('registra una interaccion de un usuario autenticado', async () => {
      supabase._on({ id: 'place-1' }); // place exists
      const insertChain = supabase._on(null); // insert ok

      await expect(
        service.track(
          'place-1',
          'user-1',
          { interaction_type: InteractionType.CALL_CLICK },
          { userAgent: 'Mozilla/5.0' },
        ),
      ).resolves.toBeUndefined();

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          place_id: 'place-1',
          user_id: 'user-1',
          interaction_type: InteractionType.CALL_CLICK,
          dedup_key: expect.stringContaining('user:user-1'),
          user_agent_hash: expect.any(String),
        }),
      );
    });

    it('registra una interaccion anonima con hash de sesion sin guardar el id crudo', async () => {
      supabase._on({ id: 'place-1' });
      const insertChain = supabase._on(null);

      await expect(
        service.track('place-1', null, {
          interaction_type: InteractionType.PROFILE_VIEW,
          anonymous_session_id: 'session-abc-123',
        }),
      ).resolves.toBeUndefined();

      const inserted = insertChain.insert.mock.calls[0][0];
      expect(inserted.user_id).toBeNull();
      expect(inserted.anonymous_session_hash).toHaveLength(64);
      expect(JSON.stringify(inserted)).not.toContain('session-abc-123');
      expect(inserted.dedup_key).toContain('anon:');
    });

    it('lanza 404 si el place no existe', async () => {
      supabase._on(null);
      await expect(
        service.track('x', null, {
          interaction_type: InteractionType.PROFILE_VIEW,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('ignora bots conocidos sin insertar ni consultar la base', async () => {
      await expect(
        service.track(
          'place-1',
          null,
          { interaction_type: InteractionType.PROFILE_VIEW },
          { userAgent: 'Googlebot/2.1' },
        ),
      ).resolves.toBeUndefined();

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('trata el unique de dedup_key como exito idempotente', async () => {
      supabase._on({ id: 'place-1' });
      supabase._on(null, {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "microsite_interactions_dedup_key_uidx"',
      });

      await expect(
        service.track('place-1', null, {
          interaction_type: InteractionType.WHATSAPP_CLICK,
          anonymous_session_id: 'session-abc-123',
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ── Resumen de metricas ─────────────────────────────────────────

  describe('getSummary', () => {
    it('owner ve metricas con comparativa con periodo anterior', async () => {
      supabase._on({ owner_id: 'owner-1' }); // ownership
      supabase._onRpc([
        {
          total_views: 100,
          total_calls: 20,
          total_whatsapp: 15,
          total_reservations: 5,
          total_directions: 30,
          total_promo_views: 10,
          total_interactions: 180,
          prev_total_views: 50,
          prev_total_calls: 10,
          prev_total_whatsapp: 5,
          prev_total_reservations: 0,
          prev_total_directions: 25,
          prev_total_promo_views: 5,
          prev_total_interactions: 150,
          views_change_percent: 100.0,
          calls_change_percent: 100.0,
          whatsapp_change_percent: 200.0,
          reservations_change_percent: 100.0,
          directions_change_percent: 20.0,
          promo_views_change_percent: 100.0,
          change_percent: 20.0,
        },
      ]);

      const result = await service.getSummary(
        'place-1',
        'owner-1',
        'business',
        '2026-04-01',
        '2026-04-30',
      );

      expect(result.total_interactions).toBe(180);
      expect(result.prev_total_views).toBe(50);
      expect(result.views_change_percent).toBe(100.0);
      expect(result.reservations_change_percent).toBe(100.0);
      expect(result.change_percent).toBe(20.0);
      expect(result.period.from).toBe('2026-04-01');
    });

    it('rechaza a quien no es owner ni admin', async () => {
      supabase._on({ owner_id: 'owner-1' });
      await expect(
        service.getSummary(
          'place-1',
          'user-X',
          'business',
          '2026-04-01',
          '2026-04-30',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('admin puede ver metricas de cualquier place', async () => {
      supabase._onRpc([
        {
          total_views: 0,
          total_calls: 0,
          total_whatsapp: 0,
          total_reservations: 0,
          total_directions: 0,
          total_promo_views: 0,
          total_interactions: 0,
          prev_total_views: 0,
          prev_total_calls: 0,
          prev_total_whatsapp: 0,
          prev_total_reservations: 0,
          prev_total_directions: 0,
          prev_total_promo_views: 0,
          prev_total_interactions: 0,
          views_change_percent: 0,
          calls_change_percent: 0,
          whatsapp_change_percent: 0,
          reservations_change_percent: 0,
          directions_change_percent: 0,
          promo_views_change_percent: 0,
          change_percent: 0,
        },
      ]);

      const result = await service.getSummary(
        'place-1',
        'admin-1',
        'admin',
        '2026-04-01',
        '2026-04-30',
      );
      expect(result.total_interactions).toBe(0);
    });
  });

  // ── Time series ─────────────────────────────────────────────────

  describe('getTimeseries', () => {
    it('devuelve buckets por dia con conteos casteados a numero', async () => {
      supabase._on({ owner_id: 'owner-1' });
      supabase._onRpc([
        {
          bucket: '2026-04-01T00:00:00Z',
          views: '10',
          calls: '2',
          whatsapp: '1',
          reservations: '0',
          directions: '3',
          promo_views: '0',
          total: '16',
        },
      ]);

      const result = await service.getTimeseries(
        'place-1',
        'owner-1',
        'business',
        '2026-04-01',
        '2026-04-30',
        TimeseriesGranularity.DAY,
      );

      expect(result).toHaveLength(1);
      expect(result[0].views).toBe(10);
      expect(result[0].total).toBe(16);
    });
  });
});
