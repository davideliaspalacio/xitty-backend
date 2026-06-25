import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { ConsentsService } from './consents.service';
import { ConsentType } from './dto/grant-consent.dto';

function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from',
    'select',
    'upsert',
    'insert',
    'update',
    'delete',
    'eq',
    'in',
    'order',
    'maybeSingle',
    'single',
  ];
  methods.forEach((m) => (chain[m] = jest.fn().mockReturnValue(chain)));
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createMockSupabase() {
  const mock: any = { from: jest.fn() };
  const calls: any[] = [];
  mock._calls = calls;
  mock._on = (data: any, error?: any) => {
    const c = createChain({ data, error: error || null });
    mock.from.mockReturnValueOnce(c);
    calls.push(c);
    return c;
  };
  mock.from.mockImplementation(() => createChain({ data: null, error: null }));
  return mock;
}

describe('ConsentsService', () => {
  let service: ConsentsService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentsService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get<ConsentsService>(ConsentsService);
  });

  describe('grant', () => {
    it('crea un row con granted=true y revoked_at=null', async () => {
      const now = new Date().toISOString();
      const chain = supabase._on({
        user_id: 'u1',
        consent_type: 'location_tracking',
        granted: true,
        granted_at: now,
        revoked_at: null,
      });

      const result = await service.grant('u1', {
        consent_type: ConsentType.LOCATION_TRACKING,
      });

      expect(result.granted).toBe(true);
      expect(result.consent_type).toBe('location_tracking');
      expect(result.revoked_at).toBeNull();
      // Verifica que se llamó upsert con la fila esperada
      expect(chain.upsert).toHaveBeenCalled();
      const upsertArg = chain.upsert.mock.calls[0][0];
      expect(upsertArg.user_id).toBe('u1');
      expect(upsertArg.consent_type).toBe('location_tracking');
      expect(upsertArg.granted).toBe(true);
      expect(upsertArg.revoked_at).toBeNull();
    });

    it('rechaza consent_type inválido con BadRequestException', async () => {
      await expect(
        service.grant('u1', { consent_type: 'banana' as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revoke', () => {
    it('setea revoked_at y granted=false', async () => {
      const revokedAt = new Date().toISOString();
      const chain = supabase._on({
        user_id: 'u1',
        consent_type: 'location_tracking',
        granted: false,
        granted_at: revokedAt,
        revoked_at: revokedAt,
      });

      const result = await service.revoke('u1', ConsentType.LOCATION_TRACKING);

      expect(result.granted).toBe(false);
      expect(result.revoked_at).toBeTruthy();
      expect(chain.upsert).toHaveBeenCalled();
      const upsertArg = chain.upsert.mock.calls[0][0];
      expect(upsertArg.granted).toBe(false);
      expect(upsertArg.revoked_at).toBeTruthy();
      // Auditoría Ley 1581: revoke NO debe tocar granted_at (preserva la fecha
      // original de otorgamiento). En UPDATE se conserva; en INSERT nuevo toma
      // el DEFAULT now() de la columna.
      expect(upsertArg.granted_at).toBeUndefined();
    });

    it('rechaza consent_type inválido en revoke', async () => {
      await expect(service.revoke('u1', 'banana' as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getByUser', () => {
    it('retorna array de consents del usuario', async () => {
      supabase._on([
        {
          user_id: 'u1',
          consent_type: 'location_tracking',
          granted: true,
          granted_at: '2026-06-01T00:00:00Z',
          revoked_at: null,
        },
        {
          user_id: 'u1',
          consent_type: 'marketing',
          granted: false,
          granted_at: '2026-05-01T00:00:00Z',
          revoked_at: '2026-05-15T00:00:00Z',
        },
      ]);

      const result = await service.getByUser('u1');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].consent_type).toBe('location_tracking');
      expect(result[0].granted).toBe(true);
      expect(result[1].consent_type).toBe('marketing');
      expect(result[1].granted).toBe(false);
    });

    it('retorna array vacío si el usuario no tiene consents', async () => {
      supabase._on([]);
      const result = await service.getByUser('u1');
      expect(result).toEqual([]);
    });

    it('retorna array vacío si data es null', async () => {
      supabase._on(null);
      const result = await service.getByUser('u1');
      expect(result).toEqual([]);
    });
  });
});
