import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { EnrichmentService } from './enrichment.service';
import { QualityScorerService } from './quality-scorer.service';
import { DedupService } from './dedup.service';
import {
  ENRICHMENT_PROVIDER,
  EnrichmentProvider,
} from './providers/enrichment-provider.interface';

class FakeProvider implements EnrichmentProvider {
  calls: string[] = [];
  responses: Array<string | Error> = [];

  enqueue(r: string | Error) {
    this.responses.push(r);
  }

  async generate(prompt: string): Promise<string> {
    this.calls.push(prompt);
    if (this.responses.length === 0) {
      throw new Error('FakeProvider: no canned response');
    }
    const next = this.responses.shift()!;
    if (next instanceof Error) throw next;
    return next;
  }
}

describe('EnrichmentService', () => {
  let service: EnrichmentService;
  let provider: FakeProvider;
  let dedup: DedupService;

  beforeEach(async () => {
    provider = new FakeProvider();
    // Dedup con supabase stub que SIEMPRE retorna null en findDuplicate
    // (los tests que necesiten verificar dedup mockean directamente).
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrichmentService,
        QualityScorerService,
        DedupService,
        { provide: ENRICHMENT_PROVIDER, useValue: provider },
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
      ],
    }).compile();

    service = module.get<EnrichmentService>(EnrichmentService);
    dedup = module.get<DedupService>(DedupService);
  });

  const validPayload = JSON.stringify({
    title: 'Carnaval de Barranquilla',
    description: 'a'.repeat(150),
    category_hint: 'festival',
    location_name: 'Vía 40',
    lat: 10.96,
    lng: -74.78,
    starts_at: '2026-02-14T08:00:00Z',
    ends_at: '2026-02-17T22:00:00Z',
    price_cop: 50000,
    image_url: 'https://x/img.jpg',
  });

  // ──────────────────────────────────────────────────────────────────────
  // happy path
  // ──────────────────────────────────────────────────────────────────────
  it('happy path: parsea JSON valido y devuelve EnrichedItem con quality_score', async () => {
    provider.enqueue(validPayload);

    const result = await service.enrich({ raw: 'snippet' }, 'instagram');

    expect(result.title).toBe('Carnaval de Barranquilla');
    expect(result.source_kind).toBe('instagram');
    expect(result.quality_score).toBeCloseTo(1.0, 5);
    expect(result.raw_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(provider.calls).toHaveLength(1);
  });

  it('incluye el sourceKind y un snippet del payload en el prompt', async () => {
    provider.enqueue(validPayload);
    await service.enrich({ caption: 'gran evento' }, 'eventbrite');

    const prompt = provider.calls[0];
    expect(prompt).toContain('eventbrite');
    expect(prompt).toContain('curador de turismo de Barranquilla');
    expect(prompt).toContain('NO inventes precios ni horarios');
    expect(prompt).toContain('gran evento');
  });

  // ──────────────────────────────────────────────────────────────────────
  // retry x2 si JSON invalido
  // ──────────────────────────────────────────────────────────────────────
  it('retry: si el primer response NO es JSON valido, reintenta y devuelve el segundo', async () => {
    provider.enqueue('no soy json {{{');
    provider.enqueue(validPayload);

    const result = await service.enrich({ raw: 'x' }, 'site');
    expect(result.title).toBe('Carnaval de Barranquilla');
    expect(provider.calls).toHaveLength(2);
  });

  it('retry: si el primer response es JSON pero NO matchea schema, reintenta', async () => {
    // Falta title (required) → zod falla
    provider.enqueue(JSON.stringify({ description: 'sin titulo' }));
    provider.enqueue(validPayload);

    const result = await service.enrich({ raw: 'x' }, 'site');
    expect(result.title).toBe('Carnaval de Barranquilla');
    expect(provider.calls).toHaveLength(2);
  });

  it('retry: solo reintenta hasta 2 veces (3 calls total), luego tira BadRequest', async () => {
    provider.enqueue('garbage 1');
    provider.enqueue('garbage 2');
    provider.enqueue('garbage 3');

    await expect(service.enrich({ raw: 'x' }, 'site')).rejects.toThrow(
      BadRequestException,
    );
    expect(provider.calls).toHaveLength(3); // 1 inicial + 2 retries
  });

  // ──────────────────────────────────────────────────────────────────────
  // validacion zod: campos invalidos se rechazan
  // ──────────────────────────────────────────────────────────────────────
  it('valida zod: description >500 chars se rechaza', async () => {
    const tooLong = JSON.stringify({
      title: 'x',
      description: 'a'.repeat(501),
    });
    // tras retry tambien falla
    provider.enqueue(tooLong);
    provider.enqueue(tooLong);
    provider.enqueue(tooLong);

    await expect(service.enrich({}, 'src')).rejects.toThrow(BadRequestException);
  });

  it('valida zod: lat/lng como string se coercen a numero', async () => {
    provider.enqueue(
      JSON.stringify({
        title: 'x',
        lat: '10.96',
        lng: '-74.78',
      }),
    );

    const result = await service.enrich({}, 'src');
    expect(result.lat).toBe(10.96);
    expect(result.lng).toBe(-74.78);
  });

  it('valida zod: starts_at invalido como ISO date se rechaza', async () => {
    const bad = JSON.stringify({
      title: 'x',
      starts_at: 'no-es-fecha',
    });
    provider.enqueue(bad);
    provider.enqueue(bad);
    provider.enqueue(bad);

    await expect(service.enrich({}, 'src')).rejects.toThrow(BadRequestException);
  });

  // ──────────────────────────────────────────────────────────────────────
  // fallback: provider tira → service propaga BadRequest
  // ──────────────────────────────────────────────────────────────────────
  it('fallback: si el provider tira en todos los intentos, propaga BadRequestException', async () => {
    provider.enqueue(new Error('gemini down'));
    provider.enqueue(new Error('gemini down 2'));
    provider.enqueue(new Error('gemini down 3'));

    await expect(service.enrich({}, 'src')).rejects.toThrow(BadRequestException);
    expect(provider.calls).toHaveLength(3);
  });

  it('fallback: si los primeros 2 fallan y el 3ro responde valido, retorna OK', async () => {
    provider.enqueue(new Error('500'));
    provider.enqueue('not json');
    provider.enqueue(validPayload);

    const result = await service.enrich({}, 'src');
    expect(result.title).toBe('Carnaval de Barranquilla');
    expect(provider.calls).toHaveLength(3);
  });

  // ──────────────────────────────────────────────────────────────────────
  // quality + dedup wiring
  // ──────────────────────────────────────────────────────────────────────
  it('item parcial: calcula quality_score < 1.0', async () => {
    provider.enqueue(JSON.stringify({ title: 'Solo titulo' }));

    const result = await service.enrich({}, 'src');
    expect(result.quality_score).toBeCloseTo(0.2, 5);
  });

  it('raw_hash es el output de dedup.computeHash(item)', async () => {
    provider.enqueue(validPayload);
    const spy = jest.spyOn(dedup, 'computeHash');

    const result = await service.enrich({}, 'src');
    expect(spy).toHaveBeenCalled();
    expect(result.raw_hash).toBe(spy.mock.results[0].value);
  });

  it('detecta duplicado: si findDuplicate retorna row, marca result como duplicate', async () => {
    provider.enqueue(validPayload);
    jest
      .spyOn(dedup, 'findDuplicate')
      .mockResolvedValueOnce({ id: 'existing-1', raw_hash: 'whatever' });

    const result = await service.enrich({}, 'src');
    expect(result.is_duplicate).toBe(true);
    expect(result.duplicate_of).toBe('existing-1');
  });

  it('no-duplicado: is_duplicate=false cuando findDuplicate retorna null', async () => {
    provider.enqueue(validPayload);
    jest.spyOn(dedup, 'findDuplicate').mockResolvedValueOnce(null);

    const result = await service.enrich({}, 'src');
    expect(result.is_duplicate).toBe(false);
    expect(result.duplicate_of).toBeNull();
  });
});
