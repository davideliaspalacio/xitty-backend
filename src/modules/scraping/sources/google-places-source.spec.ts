import { GooglePlacesSource, GooglePlacesConfig } from './google-places-source';

/**
 * Tests para GooglePlacesSource.
 *
 * Estrategia: inyectamos un `fetch` fake via el constructor (DI por argumento
 * opcional) — asi NO tocamos el `global.fetch` y los tests son aislados.
 *
 * Cobertura:
 *  - parseo correcto de la Places API (New) v1
 *  - fallback a mock data cuando no hay API key
 *  - retry exponencial en 429
 */
describe('GooglePlacesSource', () => {
  const baseConfig: GooglePlacesConfig = {
    lat: 10.9685,
    lng: -74.7813,
    radius_m: 1500,
    type: 'restaurant',
    max_results: 10,
  };

  const ORIGINAL_KEY = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = 'fake-key-for-tests';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (ORIGINAL_KEY === undefined) {
      delete process.env.GOOGLE_MAPS_API_KEY;
    } else {
      process.env.GOOGLE_MAPS_API_KEY = ORIGINAL_KEY;
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // happy path: parseo correcto del JSON de Places API (New)
  // ────────────────────────────────────────────────────────────────────
  it('fetch: parsea correctamente la respuesta de Places API (New) v1', async () => {
    const apiPayload = {
      places: [
        {
          id: 'ChIJabc123',
          displayName: { text: 'Restaurante La Cueva' },
          formattedAddress: 'Calle 59 #59-100, Barranquilla',
          location: { latitude: 10.99, longitude: -74.79 },
          editorialSummary: { text: 'Clasico restaurante barranquillero' },
          types: ['restaurant', 'food'],
          primaryType: 'restaurant',
          googleMapsUri: 'https://maps.google.com/?cid=123',
        },
        {
          id: 'ChIJdef456',
          displayName: { text: 'Aluna' },
          formattedAddress: 'Carrera 53 #76-115',
          location: { latitude: 11.0, longitude: -74.81 },
          types: ['restaurant'],
          primaryType: 'restaurant',
          googleMapsUri: 'https://maps.google.com/?cid=456',
        },
      ],
    };

    const fakeFetch = jest.fn().mockResolvedValue(
      makeResponse(200, apiPayload),
    );

    const source = new GooglePlacesSource({ fetchImpl: fakeFetch as any });
    const items = await source.fetch(baseConfig);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      external_id: 'ChIJabc123',
      name: 'Restaurante La Cueva',
      address: 'Calle 59 #59-100, Barranquilla',
      latitude: 10.99,
      longitude: -74.79,
      description: 'Clasico restaurante barranquillero',
      category: 'restaurant',
      source_url: 'https://maps.google.com/?cid=123',
    });
    expect(items[0].raw_payload).toBeDefined();
    expect(items[1].external_id).toBe('ChIJdef456');
  });

  it('fetch: extrae perfil completo (foto, teléfono, web, horarios, precio, reseñas)', async () => {
    const apiPayload = {
      places: [
        {
          id: 'ChIJfull',
          displayName: { text: 'La Cevichería' },
          formattedAddress: 'Calle 39 #7-14, Cartagena',
          location: { latitude: 10.427, longitude: -75.548 },
          primaryType: 'restaurant',
          businessStatus: 'OPERATIONAL',
          photos: [{ name: 'places/ChIJfull/photos/AbC' }],
          rating: 4.6,
          userRatingCount: 3200,
          priceLevel: 'PRICE_LEVEL_EXPENSIVE',
          nationalPhoneNumber: '+57 605 664 5255',
          websiteUri: 'https://lacevicheria.co',
          regularOpeningHours: {
            weekdayDescriptions: ['Lunes: 12:00–23:00', 'Martes: 12:00–23:00'],
          },
        },
      ],
    };
    const fakeFetch = jest.fn().mockResolvedValue(makeResponse(200, apiPayload));
    const source = new GooglePlacesSource({ fetchImpl: fakeFetch as any });
    const items = await source.fetch(baseConfig);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: 'La Cevichería',
      rating: 4.6,
      review_count: 3200,
      phone: '+57 605 664 5255',
      website: 'https://lacevicheria.co',
      price_level: 3,
      business_status: 'OPERATIONAL',
    });
    expect(items[0].opening_hours).toEqual([
      'Lunes: 12:00–23:00',
      'Martes: 12:00–23:00',
    ]);
    // La foto se convierte en la media URL (sin key), para re-hospedar luego.
    expect(items[0].image_url).toContain('places/ChIJfull/photos/AbC/media');
  });

  it('fetch: parsea las reseñas (autor, estrellas, texto, fecha relativa)', async () => {
    const apiPayload = {
      places: [
        {
          id: 'ChIJrev',
          displayName: { text: 'Café del Mar' },
          location: { latitude: 10.42, longitude: -75.55 },
          primaryType: 'restaurant',
          businessStatus: 'OPERATIONAL',
          reviews: [
            {
              rating: 5,
              text: { text: 'Atardecer espectacular y buenos cócteles.' },
              relativePublishTimeDescription: 'hace 3 semanas',
              publishTime: '2026-06-10T00:00:00Z',
              authorAttribution: { displayName: 'Laura M.' },
            },
            {
              rating: 4,
              text: { text: 'Vista increíble, precios altos.' },
              relativePublishTimeDescription: 'hace 2 meses',
              authorAttribution: { displayName: 'Diego R.' },
            },
          ],
        },
      ],
    };
    const fakeFetch = jest.fn().mockResolvedValue(makeResponse(200, apiPayload));
    const source = new GooglePlacesSource({ fetchImpl: fakeFetch as any });
    const items = await source.fetch(baseConfig);

    expect(items[0].reviews).toHaveLength(2);
    expect(items[0].reviews![0]).toEqual({
      author: 'Laura M.',
      rating: 5,
      text: 'Atardecer espectacular y buenos cócteles.',
      relative_time: 'hace 3 semanas',
      publish_time: '2026-06-10T00:00:00Z',
    });
    // También incluye el field mask de reviews.
    const [, init] = fakeFetch.mock.calls[0];
    expect(init.headers['X-Goog-FieldMask']).toContain('places.reviews');
  });

  it('fetch: descarta negocios CLOSED_PERMANENTLY', async () => {
    const apiPayload = {
      places: [
        {
          id: 'ChIJopen',
          displayName: { text: 'Abierto' },
          location: { latitude: 10.4, longitude: -75.5 },
          primaryType: 'restaurant',
          businessStatus: 'OPERATIONAL',
        },
        {
          id: 'ChIJclosed',
          displayName: { text: 'Cerrado para siempre' },
          location: { latitude: 10.4, longitude: -75.5 },
          primaryType: 'restaurant',
          businessStatus: 'CLOSED_PERMANENTLY',
        },
      ],
    };
    const fakeFetch = jest.fn().mockResolvedValue(makeResponse(200, apiPayload));
    const source = new GooglePlacesSource({ fetchImpl: fakeFetch as any });
    const items = await source.fetch(baseConfig);

    expect(items).toHaveLength(1);
    expect(items[0].external_id).toBe('ChIJopen');
  });

  it('fetch: usa el header X-Goog-Api-Key y POST a places:searchNearby', async () => {
    const fakeFetch = jest.fn().mockResolvedValue(
      makeResponse(200, { places: [] }),
    );

    const source = new GooglePlacesSource({ fetchImpl: fakeFetch as any });
    await source.fetch(baseConfig);

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = fakeFetch.mock.calls[0];
    expect(url).toContain('places.googleapis.com');
    expect(url).toContain('places:searchNearby');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Goog-Api-Key']).toBe('fake-key-for-tests');
    expect(init.headers['X-Goog-FieldMask']).toBeDefined();
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body.includedTypes).toEqual(['restaurant']);
    expect(body.maxResultCount).toBe(10);
    expect(body.locationRestriction.circle.center.latitude).toBe(10.9685);
    expect(body.locationRestriction.circle.center.longitude).toBe(-74.7813);
    expect(body.locationRestriction.circle.radius).toBe(1500);
  });

  it('fetch: respuesta vacia (sin places) retorna []', async () => {
    const fakeFetch = jest.fn().mockResolvedValue(makeResponse(200, {}));
    const source = new GooglePlacesSource({ fetchImpl: fakeFetch as any });
    const items = await source.fetch(baseConfig);
    expect(items).toEqual([]);
  });

  it('fetch: kind es "google-places"', () => {
    const source = new GooglePlacesSource();
    expect(source.kind).toBe('google-places');
  });

  // ────────────────────────────────────────────────────────────────────
  // mock data cuando no hay API key
  // ────────────────────────────────────────────────────────────────────
  it('fetch: sin GOOGLE_MAPS_API_KEY retorna mock data plausible (8 lugares)', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;

    const fakeFetch = jest.fn();
    const source = new GooglePlacesSource({ fetchImpl: fakeFetch as any });
    const items = await source.fetch(baseConfig);

    expect(fakeFetch).not.toHaveBeenCalled();
    expect(items).toHaveLength(8);
    for (const item of items) {
      expect(item.external_id).toMatch(/^mock-google-places-/);
      expect(item.name).toBeTruthy();
      expect(typeof item.latitude).toBe('number');
      expect(typeof item.longitude).toBe('number');
      // Plausible Barranquilla coords
      expect(item.latitude).toBeGreaterThan(10.9);
      expect(item.latitude).toBeLessThan(11.1);
      expect(item.longitude).toBeGreaterThan(-74.9);
      expect(item.longitude).toBeLessThan(-74.7);
    }
  });

  it('fetch: mock data respeta el filtro por type=tourist_attraction', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const source = new GooglePlacesSource();
    const items = await source.fetch({
      ...baseConfig,
      type: 'tourist_attraction',
    });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.category).toBe('tourist_attraction');
    }
  });

  it('fetch: mock data respeta max_results', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const source = new GooglePlacesSource();
    const items = await source.fetch({ ...baseConfig, max_results: 3 });
    expect(items).toHaveLength(3);
  });

  // ────────────────────────────────────────────────────────────────────
  // retry exponencial en 429
  // ────────────────────────────────────────────────────────────────────
  it('fetch: en 429 hace retry exponencial y eventualmente devuelve OK', async () => {
    const okPayload = {
      places: [
        {
          id: 'ChIJok',
          displayName: { text: 'Por fin OK' },
          location: { latitude: 11.0, longitude: -74.8 },
          types: ['restaurant'],
        },
      ],
    };

    const fakeFetch = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(429, { error: 'rate limited' }))
      .mockResolvedValueOnce(makeResponse(429, { error: 'rate limited' }))
      .mockResolvedValueOnce(makeResponse(200, okPayload));

    const sleeps: number[] = [];
    const sleepFn = jest.fn().mockImplementation((ms: number) => {
      sleeps.push(ms);
      return Promise.resolve();
    });

    const source = new GooglePlacesSource({
      fetchImpl: fakeFetch as any,
      sleepFn,
      maxRetries: 3,
      baseBackoffMs: 100,
    });

    const items = await source.fetch(baseConfig);

    expect(items).toHaveLength(1);
    expect(items[0].external_id).toBe('ChIJok');
    expect(fakeFetch).toHaveBeenCalledTimes(3);

    // Backoff exponencial: 100, 200 (cuatro fixtures permitirian 400, pero solo 2 retries)
    expect(sleeps).toHaveLength(2);
    expect(sleeps[0]).toBeGreaterThanOrEqual(100);
    expect(sleeps[1]).toBeGreaterThanOrEqual(200);
    // y cada backoff es mayor que el anterior
    expect(sleeps[1]).toBeGreaterThan(sleeps[0]);
  });

  it('fetch: en 429 persistente agota retries y retorna [] (no rompe pipeline)', async () => {
    const fakeFetch = jest
      .fn()
      .mockResolvedValue(makeResponse(429, { error: 'rate limited' }));

    const sleepFn = jest.fn().mockResolvedValue(undefined);

    const source = new GooglePlacesSource({
      fetchImpl: fakeFetch as any,
      sleepFn,
      maxRetries: 3,
      baseBackoffMs: 50,
    });

    const items = await source.fetch(baseConfig);

    expect(items).toEqual([]);
    // 1 intento inicial + 3 retries = 4 calls
    expect(fakeFetch).toHaveBeenCalledTimes(4);
  });

  it('fetch: en 500 NO hace retry y retorna [] (best-effort)', async () => {
    const fakeFetch = jest
      .fn()
      .mockResolvedValue(makeResponse(500, { error: 'server' }));

    const source = new GooglePlacesSource({
      fetchImpl: fakeFetch as any,
      sleepFn: jest.fn().mockResolvedValue(undefined),
      maxRetries: 3,
      baseBackoffMs: 10,
    });

    const items = await source.fetch(baseConfig);
    expect(items).toEqual([]);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('fetch: si fetch tira (network error) retorna [] (no rompe pipeline)', async () => {
    const fakeFetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const source = new GooglePlacesSource({
      fetchImpl: fakeFetch as any,
      sleepFn: jest.fn().mockResolvedValue(undefined),
      maxRetries: 1,
      baseBackoffMs: 10,
    });

    const items = await source.fetch(baseConfig);
    expect(items).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────
function makeResponse(status: number, body: any): any {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}
