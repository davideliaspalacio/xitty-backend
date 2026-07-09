import { QualityScorerService } from './quality-scorer.service';
import { LlmEnrichedItem } from './schema/enriched-item.schema';

describe('QualityScorerService', () => {
  let scorer: QualityScorerService;

  beforeEach(() => {
    scorer = new QualityScorerService();
  });

  function makeItem(overrides: Partial<LlmEnrichedItem> = {}): LlmEnrichedItem {
    return {
      title: '',
      description: null,
      category_hint: null,
      location_name: null,
      lat: null,
      lng: null,
      starts_at: null,
      ends_at: null,
      price_cop: null,
      ...overrides,
    };
  }

  // ── Texto (IA) ────────────────────────────────────────────────────────
  it('da 0 a un item completamente vacio (sin title)', () => {
    expect(scorer.score(makeItem({ title: '' }))).toBe(0);
  });

  it('da 0.15 a un item que solo tiene title', () => {
    expect(
      scorer.score(makeItem({ title: 'Carnaval de Barranquilla' })),
    ).toBeCloseTo(0.15, 5);
  });

  it('suma 0.15 por description >80 chars', () => {
    const item = makeItem({ title: 'x', description: 'a'.repeat(81) });
    expect(scorer.score(item)).toBeCloseTo(0.3, 5);
  });

  it('NO suma description si tiene <=80 chars', () => {
    const item = makeItem({ title: 'x', description: 'a'.repeat(80) });
    expect(scorer.score(item)).toBeCloseTo(0.15, 5);
  });

  it('NO suma description si es solo whitespace', () => {
    const item = makeItem({ title: 'x', description: '   '.repeat(50) });
    expect(scorer.score(item)).toBeCloseTo(0.15, 5);
  });

  it('suma 0.10 por location_name', () => {
    const item = makeItem({ title: 'x', location_name: 'Plaza de la Paz' });
    expect(scorer.score(item)).toBeCloseTo(0.25, 5);
  });

  it('suma 0.10 por fecha (starts_at) o precio, sin duplicar', () => {
    expect(
      scorer.score(makeItem({ title: 'x', starts_at: '2026-07-15T20:00:00Z' })),
    ).toBeCloseTo(0.25, 5);
    expect(
      scorer.score(makeItem({ title: 'x', ends_at: '2026-07-15T20:00:00Z' })),
    ).toBeCloseTo(0.25, 5);
    expect(
      scorer.score(makeItem({ title: 'x', price_cop: 50000 })),
    ).toBeCloseTo(0.25, 5);
    // fecha + precio no suman doble: sigue siendo un solo bucket de 0.10
    expect(
      scorer.score(
        makeItem({
          title: 'x',
          starts_at: '2026-07-15T20:00:00Z',
          price_cop: 1,
        }),
      ),
    ).toBeCloseTo(0.25, 5);
  });

  // ── Señales de realidad (fuente) ──────────────────────────────────────
  it('suma 0.15 por foto de la fuente (signal hasImage)', () => {
    expect(
      scorer.score(makeItem({ title: 'x' }), { hasImage: true }),
    ).toBeCloseTo(0.3, 5);
  });

  it('suma hasta 0.15 por rating proporcional', () => {
    expect(scorer.score(makeItem({ title: 'x' }), { rating: 5 })).toBeCloseTo(
      0.3,
      5,
    );
    expect(scorer.score(makeItem({ title: 'x' }), { rating: 2.5 })).toBeCloseTo(
      0.225,
      5,
    );
  });

  it('escalona por nº de reseñas', () => {
    expect(
      scorer.score(makeItem({ title: 'x' }), { reviewCount: 600 }),
    ).toBeCloseTo(0.45, 5);
    expect(
      scorer.score(makeItem({ title: 'x' }), { reviewCount: 120 }),
    ).toBeCloseTo(0.37, 5);
    expect(
      scorer.score(makeItem({ title: 'x' }), { reviewCount: 3 }),
    ).toBeCloseTo(0.21, 5);
    expect(
      scorer.score(makeItem({ title: 'x' }), { reviewCount: 0 }),
    ).toBeCloseTo(0.15, 5);
  });

  it('da 1.0 a un item completo con señales fuertes', () => {
    const item = makeItem({
      title: 'Restaurante La Cueva',
      description: 'a'.repeat(120),
      location_name: 'Carrera 43',
      starts_at: '2026-02-20T08:00:00Z',
      price_cop: 80000,
    });
    const s = scorer.score(item, {
      hasImage: true,
      rating: 5,
      reviewCount: 800,
    });
    expect(s).toBeCloseTo(1.0, 5);
  });

  it('clampa el resultado entre 0 y 1', () => {
    const item = makeItem({
      title: 'x',
      description: 'a'.repeat(500),
      location_name: 'X',
      starts_at: '2026-01-01T00:00:00Z',
      price_cop: 1,
    });
    const s = scorer.score(item, {
      hasImage: true,
      rating: 5,
      reviewCount: 9999,
    });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
