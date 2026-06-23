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
      image_url: null,
      ...overrides,
    };
  }

  it('da 0 a un item completamente vacio (sin title)', () => {
    const item = makeItem({ title: '' });
    expect(scorer.score(item)).toBe(0);
  });

  it('da 0.2 a un item que solo tiene title', () => {
    const item = makeItem({ title: 'Carnaval de Barranquilla' });
    expect(scorer.score(item)).toBeCloseTo(0.2, 5);
  });

  it('da +0.2 cuando tiene description >100 chars', () => {
    const longDesc = 'a'.repeat(101);
    const item = makeItem({ title: 'x', description: longDesc });
    expect(scorer.score(item)).toBeCloseTo(0.4, 5);
  });

  it('NO suma description si tiene <=100 chars', () => {
    const shortDesc = 'a'.repeat(100);
    const item = makeItem({ title: 'x', description: shortDesc });
    expect(scorer.score(item)).toBeCloseTo(0.2, 5);
  });

  it('suma 0.15 por location_name', () => {
    const item = makeItem({ title: 'x', location_name: 'Plaza de la Paz' });
    expect(scorer.score(item)).toBeCloseTo(0.35, 5);
  });

  it('suma 0.15 por fecha (starts_at)', () => {
    const item = makeItem({ title: 'x', starts_at: '2026-07-15T20:00:00Z' });
    expect(scorer.score(item)).toBeCloseTo(0.35, 5);
  });

  it('suma 0.15 por precio', () => {
    const item = makeItem({ title: 'x', price_cop: 50000 });
    expect(scorer.score(item)).toBeCloseTo(0.35, 5);
  });

  it('suma 0.15 por imagen', () => {
    const item = makeItem({ title: 'x', image_url: 'https://x/y.jpg' });
    expect(scorer.score(item)).toBeCloseTo(0.35, 5);
  });

  it('da 1.0 a un item completo', () => {
    const item = makeItem({
      title: 'Carnaval',
      description: 'a'.repeat(150),
      location_name: 'Vía 40',
      starts_at: '2026-02-20T08:00:00Z',
      price_cop: 80000,
      image_url: 'https://x/y.jpg',
    });
    expect(scorer.score(item)).toBeCloseTo(1.0, 5);
  });

  it('clampa el resultado entre 0 y 1', () => {
    const item = makeItem({
      title: 'x',
      description: 'a'.repeat(500),
      location_name: 'X',
      starts_at: '2026-01-01T00:00:00Z',
      ends_at: '2026-01-02T00:00:00Z',
      price_cop: 1,
      image_url: 'https://x/y.jpg',
    });
    const s = scorer.score(item);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('NO suma fecha si starts_at es null pero ends_at tampoco existe', () => {
    const item = makeItem({ title: 'x', starts_at: null, ends_at: null });
    expect(scorer.score(item)).toBeCloseTo(0.2, 5);
  });

  it('suma fecha tambien si solo ends_at esta presente', () => {
    const item = makeItem({ title: 'x', ends_at: '2026-07-15T20:00:00Z' });
    expect(scorer.score(item)).toBeCloseTo(0.35, 5);
  });

  it('NO suma description si description es solo whitespace', () => {
    const item = makeItem({ title: 'x', description: '   '.repeat(50) });
    expect(scorer.score(item)).toBeCloseTo(0.2, 5);
  });
});
