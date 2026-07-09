import { BadRequestException, NotImplementedException } from '@nestjs/common';

import { ScraperSourceFactory } from './source.factory';
import { EventbriteSource } from './eventbrite-source';
import { TavilySearchSource } from './tavily-search-source';

describe('ScraperSourceFactory', () => {
  const factory = new ScraperSourceFactory();
  type SourceInput = Parameters<ScraperSourceFactory['build']>[0];

  const base = { name: 'test-source', config: {} as Record<string, unknown> };

  it('construye EventbriteSource para kind=eventbrite', () => {
    const src = factory.build({ ...base, kind: 'eventbrite' });
    expect(src).toBeInstanceOf(EventbriteSource);
    expect(typeof src.fetch).toBe('function');
  });

  it('construye TavilySearchSource para kind=tavily con query', () => {
    const src = factory.build({
      ...base,
      kind: 'tavily',
      config: { query: 'eventos barranquilla' },
    });
    expect(src).toBeInstanceOf(TavilySearchSource);
  });

  it('tira BadRequest si tavily no trae query', () => {
    expect(() =>
      factory.build({ ...base, kind: 'tavily', config: {} }),
    ).toThrow(BadRequestException);
  });

  it('construye un adapter ScraperSource para kind=google_places', () => {
    const src = factory.build({
      ...base,
      kind: 'google_places',
      config: {
        lat: 11,
        lng: -74,
        radius_m: 3000,
        type: 'restaurant',
        max_results: 5,
      },
    });
    expect(src.id).toBe('google-places');
    expect(typeof src.fetch).toBe('function');
  });

  it('aplica defaults de Barranquilla si google_places no trae config completa', () => {
    // No debe tirar: rellena lat/lng/type/radius/max con defaults.
    const src = factory.build({ ...base, kind: 'google_places', config: {} });
    expect(src.id).toBe('google-places');
  });

  it.each(['firecrawl', 'manual'] as const)(
    'tira NotImplemented para kind=%s',
    (kind) => {
      expect(() => factory.build({ ...base, kind })).toThrow(
        NotImplementedException,
      );
    },
  );

  it('tira BadRequest para un kind desconocido', () => {
    const source = { ...base, kind: 'wat' } as unknown as SourceInput;

    expect(() => factory.build(source)).toThrow(BadRequestException);
  });
});
