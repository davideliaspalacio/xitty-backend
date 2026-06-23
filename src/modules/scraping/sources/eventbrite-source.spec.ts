import { EventbriteSource, EventbriteSourceConfig } from './eventbrite-source';

/**
 * Helper: response shape de la Eventbrite API v3 /v3/events/search/.
 * Solo modelamos los campos que la source extrae.
 */
function fakeEventbriteResponse(
  events: Array<Partial<{
    id: string;
    name: { text: string };
    description: { text: string };
    url: string;
    start: { utc: string };
    end: { utc: string };
    category_id: string;
    venue: {
      address: {
        localized_address_display?: string;
        latitude?: string;
        longitude?: string;
      };
    };
  }>>,
) {
  return {
    events,
    pagination: { object_count: events.length, has_more_items: false },
  };
}

describe('EventbriteSource', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  // ── metadata basica ──────────────────────────────────────────────────

  describe('metadata', () => {
    it('expone id, name y enabled=true por default', () => {
      const src = new EventbriteSource();
      expect(src.id).toBe('eventbrite');
      expect(src.name).toMatch(/eventbrite/i);
      expect(src.enabled).toBe(true);
    });

    it('respeta enabled=false en el config', () => {
      const src = new EventbriteSource({ enabled: false });
      expect(src.enabled).toBe(false);
    });
  });

  // ── mock fallback (sin API key) ──────────────────────────────────────

  describe('mock fallback (sin EVENTBRITE_API_KEY)', () => {
    beforeEach(() => {
      delete process.env.EVENTBRITE_API_KEY;
    });

    it('NO tira al construirse aunque falte la API key', () => {
      expect(() => new EventbriteSource()).not.toThrow();
    });

    it('fetch() devuelve 6 eventos mock cuando no hay API key', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      const src = new EventbriteSource();

      const items = await src.fetch();

      expect(items).toHaveLength(6);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('los items mock tienen external_id, name, lat/lng y source_url', async () => {
      const src = new EventbriteSource();
      const items = await src.fetch();

      for (const it of items) {
        expect(typeof it.external_id).toBe('string');
        expect(it.external_id.length).toBeGreaterThan(0);
        expect(typeof it.name).toBe('string');
        expect(it.name.length).toBeGreaterThan(0);
        expect(typeof it.latitude).toBe('number');
        expect(typeof it.longitude).toBe('number');
        expect(typeof it.source_url).toBe('string');
      }
    });

    it('los mock items tienen external_id unicos', async () => {
      const src = new EventbriteSource();
      const items = await src.fetch();
      const ids = items.map((i) => i.external_id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('los mock items quedan dentro del rango geografico de Barranquilla', async () => {
      const src = new EventbriteSource();
      const items = await src.fetch();
      for (const it of items) {
        // Barranquilla esta en lat ~10.9, lng ~-74.8
        expect(it.latitude).toBeGreaterThan(10.5);
        expect(it.latitude).toBeLessThan(11.5);
        expect(it.longitude).toBeGreaterThan(-75.5);
        expect(it.longitude).toBeLessThan(-74.5);
      }
    });

    it('los mock items setean category dentro de las soportadas', async () => {
      const src = new EventbriteSource();
      const items = await src.fetch();
      const allowed = new Set([
        'food',
        'music',
        'arts',
        'business',
        'community',
        'sports',
      ]);
      for (const it of items) {
        if (it.category) {
          expect(allowed.has(it.category)).toBe(true);
        }
      }
    });
  });

  // ── modo real con API key ────────────────────────────────────────────

  describe('modo real (con EVENTBRITE_API_KEY)', () => {
    beforeEach(() => {
      process.env.EVENTBRITE_API_KEY = 'test-token-abc';
    });

    function mockFetch(payload: unknown, status = 200) {
      return jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        }) as any,
      );
    }

    it('llama a /v3/events/search/ con Bearer token', async () => {
      const spy = mockFetch(fakeEventbriteResponse([]));
      const src = new EventbriteSource();

      await src.fetch();

      expect(spy).toHaveBeenCalledTimes(1);
      const [url, init] = spy.mock.calls[0];
      expect(String(url)).toContain('/v3/events/search/');
      const headers = (init as any).headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer test-token-abc');
    });

    it('arma query string con location.address, location.within (km) y expand=venue', async () => {
      const spy = mockFetch(fakeEventbriteResponse([]));
      const cfg: EventbriteSourceConfig = {
        location_address: 'Barranquilla, Colombia',
        location_within_km: 25,
      };
      const src = new EventbriteSource(cfg);

      await src.fetch();

      const url = new URL(String(spy.mock.calls[0][0]));
      expect(url.searchParams.get('location.address')).toBe(
        'Barranquilla, Colombia',
      );
      expect(url.searchParams.get('location.within')).toBe('25km');
      // expand=venue es necesario para obtener lat/lng en la respuesta
      expect(url.searchParams.get('expand')).toContain('venue');
    });

    it('pasa categories al query como string separado por comas', async () => {
      const spy = mockFetch(fakeEventbriteResponse([]));
      const src = new EventbriteSource({ categories: ['food', 'music'] });

      await src.fetch();

      const url = new URL(String(spy.mock.calls[0][0]));
      // Eventbrite usa parametro `categories`
      expect(url.searchParams.get('categories')).toBe('food,music');
    });

    it('respeta max_results truncando el array devuelto', async () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        id: `evt-${i}`,
        name: { text: `Evento ${i}` },
        url: `https://eventbrite.com/e/evt-${i}`,
        venue: {
          address: {
            localized_address_display: 'Barranquilla',
            latitude: '10.99',
            longitude: '-74.79',
          },
        },
      }));
      mockFetch(fakeEventbriteResponse(events));
      const src = new EventbriteSource({ max_results: 3 });

      const items = await src.fetch();
      expect(items).toHaveLength(3);
    });

    it('mapea la respuesta de Eventbrite a RawItem', async () => {
      mockFetch(
        fakeEventbriteResponse([
          {
            id: 'evt-123',
            name: { text: 'Concierto en el Malecón' },
            description: { text: 'Una noche memorable' },
            url: 'https://eventbrite.com/e/evt-123',
            start: { utc: '2026-07-15T22:00:00Z' },
            end: { utc: '2026-07-16T02:00:00Z' },
            venue: {
              address: {
                localized_address_display: 'C 84 #45-21, Barranquilla',
                latitude: '10.9876',
                longitude: '-74.7912',
              },
            },
          },
        ]),
      );
      const src = new EventbriteSource();

      const items = await src.fetch();

      expect(items).toHaveLength(1);
      const it = items[0];
      expect(it.external_id).toBe('evt-123');
      expect(it.name).toBe('Concierto en el Malecón');
      expect(it.description).toBe('Una noche memorable');
      expect(it.address).toBe('C 84 #45-21, Barranquilla');
      expect(it.latitude).toBeCloseTo(10.9876, 4);
      expect(it.longitude).toBeCloseTo(-74.7912, 4);
      expect(it.source_url).toBe('https://eventbrite.com/e/evt-123');
      expect(it.raw_payload).toBeDefined();
    });

    it('tolera eventos sin venue (latitude/longitude quedan null)', async () => {
      mockFetch(
        fakeEventbriteResponse([
          {
            id: 'evt-novenue',
            name: { text: 'Evento sin sede' },
            url: 'https://eventbrite.com/e/evt-novenue',
          },
        ]),
      );
      const src = new EventbriteSource();

      const items = await src.fetch();
      expect(items).toHaveLength(1);
      expect(items[0].latitude).toBeNull();
      expect(items[0].longitude).toBeNull();
    });

    it('si Eventbrite responde 401 (token invalido), tira con mensaje claro', async () => {
      mockFetch({ error: 'INVALID_AUTH' }, 401);
      const src = new EventbriteSource();

      await expect(src.fetch()).rejects.toThrow(/eventbrite/i);
    });

    it('si Eventbrite responde 500, tira propagando el status', async () => {
      mockFetch({ error: 'INTERNAL' }, 500);
      const src = new EventbriteSource();

      await expect(src.fetch()).rejects.toThrow(/500/);
    });

    it('si la respuesta no trae el campo events, devuelve []', async () => {
      mockFetch({ pagination: { object_count: 0 } });
      const src = new EventbriteSource();

      const items = await src.fetch();
      expect(items).toEqual([]);
    });
  });
});
