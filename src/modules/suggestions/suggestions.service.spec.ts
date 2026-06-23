import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';

// ── Supabase mock ─────────────────────────────────────────────────────────
function createMockSupabase() {
  const mock: any = { from: jest.fn(), rpc: jest.fn() };
  mock._onRpc = (data: any, error?: any) => {
    mock.rpc.mockReturnValueOnce(
      Promise.resolve({ data, error: error || null }),
    );
  };
  mock.rpc.mockImplementation(() =>
    Promise.resolve({ data: null, error: null }),
  );
  return mock;
}

describe('SuggestionsService', () => {
  let service: SuggestionsService;
  let supabase: any;

  beforeEach(async () => {
    supabase = createMockSupabase();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();
    service = module.get<SuggestionsService>(SuggestionsService);
  });

  describe('getContext', () => {
    it('llama al RPC suggestions_for con lat/lng exactos', async () => {
      supabase._onRpc({
        safety_zone: { neighborhood: 'El Prado', score: 78, tags: [], tone: 'good' },
        nearby_beach_m: null,
        price_band: null,
      });

      await service.getContext(11.005, -74.808);

      expect(supabase.rpc).toHaveBeenCalledWith('suggestions_for', {
        p_lat: 11.005,
        p_lng: -74.808,
      });
    });

    it('retorna estructura completa cuando el RPC devuelve safety_zone, playa y price_band', async () => {
      supabase._onRpc({
        safety_zone: {
          neighborhood: 'El Prado',
          score: 78,
          tags: ['turistica'],
          tone: 'good',
        },
        nearby_beach_m: 850,
        price_band: 'medio',
      });

      const result = await service.getContext(11.005, -74.808);

      expect(result.safety_zone).toEqual({
        neighborhood: 'El Prado',
        score: 78,
        tags: ['turistica'],
        tone: 'good',
      });
      expect(result.nearby_beach_m).toBe(850);
      expect(result.price_band).toBe('medio');
    });

    it('tolera RPC null retornando objeto vacio con campos null', async () => {
      supabase._onRpc(null);

      const result = await service.getContext(11.005, -74.808);

      expect(result.safety_zone).toBeNull();
      expect(result.nearby_beach_m).toBeNull();
      expect(result.price_band).toBeNull();
    });

    it('tolera RPC vacio ({}) retornando objeto con campos null', async () => {
      supabase._onRpc({});

      const result = await service.getContext(11.005, -74.808);

      expect(result.safety_zone).toBeNull();
      expect(result.nearby_beach_m).toBeNull();
      expect(result.price_band).toBeNull();
    });

    it('cuando solo hay safety_zone, los otros campos son null', async () => {
      supabase._onRpc({
        safety_zone: {
          neighborhood: 'Centro Histórico',
          score: 50,
          tags: ['turistica', 'dia'],
          tone: 'ok',
        },
      });

      const result = await service.getContext(10.969, -74.797);

      expect(result.safety_zone?.neighborhood).toBe('Centro Histórico');
      expect(result.safety_zone?.tone).toBe('ok');
      expect(result.nearby_beach_m).toBeNull();
      expect(result.price_band).toBeNull();
    });

    it('lanza BadRequestException si lat esta fuera del rango [-90,90]', async () => {
      await expect(service.getContext(95, -74.8)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getContext(-91, -74.8)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException si lng esta fuera del rango [-180,180]', async () => {
      await expect(service.getContext(11.0, 185)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getContext(11.0, -181)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException si lat o lng no son numeros', async () => {
      await expect(
        service.getContext(NaN as any, -74.8),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getContext(11.0, NaN as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el RPC retorna error', async () => {
      supabase._onRpc(null, { message: 'rpc failed' });

      await expect(service.getContext(11.0, -74.8)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propaga tone="caution" cuando score<50', async () => {
      supabase._onRpc({
        safety_zone: {
          neighborhood: 'Bocas de Ceniza',
          score: 45,
          tags: ['naturaleza', 'no_solo'],
          tone: 'caution',
        },
        nearby_beach_m: 150,
        price_band: 'asequible',
      });

      const result = await service.getContext(11.04, -74.85);

      expect(result.safety_zone?.tone).toBe('caution');
      expect(result.nearby_beach_m).toBe(150);
    });
  });
});
