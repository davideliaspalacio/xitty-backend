import { Test, TestingModule } from '@nestjs/testing';
import { NotificationSettingsService } from './notification-settings.service';

function createChain(result: any) {
  const chain: any = {};
  const methods = ['from', 'select', 'upsert', 'eq', 'maybeSingle', 'single'];
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

describe('NotificationSettingsService', () => {
  let service: NotificationSettingsService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationSettingsService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get<NotificationSettingsService>(NotificationSettingsService);
  });

  describe('getOrDefaults', () => {
    it('devuelve los settings guardados si existen', async () => {
      supabase._on({
        user_id: 'u1',
        notify_call_click: false,
        notify_whatsapp_click: true,
        notify_reservation_click: true,
        daily_summary: false,
      });

      const result = await service.getOrDefaults('u1');
      expect(result.notify_call_click).toBe(false);
      expect(result.daily_summary).toBe(false);
    });

    it('devuelve defaults (todos true) si no hay row', async () => {
      supabase._on(null);
      const result = await service.getOrDefaults('u1');
      expect(result.user_id).toBe('u1');
      expect(result.notify_call_click).toBe(true);
      expect(result.notify_whatsapp_click).toBe(true);
      expect(result.notify_reservation_click).toBe(true);
      expect(result.daily_summary).toBe(true);
    });
  });

  describe('upsert', () => {
    it('hace upsert con los campos del DTO', async () => {
      supabase._on({
        user_id: 'u1',
        notify_call_click: true,
        notify_whatsapp_click: false,
        notify_reservation_click: true,
        daily_summary: true,
      });

      const result = await service.upsert('u1', { notify_whatsapp_click: false });
      expect(result.notify_whatsapp_click).toBe(false);
    });
  });
});
