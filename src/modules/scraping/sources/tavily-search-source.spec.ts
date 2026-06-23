/**
 * Tests para TavilySearchSource.
 *
 * Cubre:
 *   - Implementacion correcta de la interfaz ScraperSource.
 *   - Fallback a mock data cuando no hay TAVILY_API_KEY (regla del proyecto).
 *   - Llamada HTTP a https://api.tavily.com/search con el body esperado.
 *   - Parseo de la respuesta de Tavily a RawItem[].
 *   - Extraccion de imagen del raw_content (primer <img> o URL .jpg/.png).
 *   - Manejo de errores HTTP (status no-2xx) y de red (fetch rechazado).
 *   - Respeto de la config (query, max_results, include_domains).
 *
 * Estrategia: stub de `global.fetch` con jest.fn() — sin pegarle a la red.
 */

import { TavilySearchSource } from './tavily-search-source';

// ── Helpers ──────────────────────────────────────────────────────────────

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(status: number, body: unknown = { error: 'boom' }): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Saca el body JSON de la N-esima llamada al mock de fetch. */
function bodyOfCall(mock: jest.Mock, callIdx = 0): any {
  const init = mock.mock.calls[callIdx][1] as RequestInit;
  return JSON.parse(init.body as string);
}

// ── Suite ────────────────────────────────────────────────────────────────

describe('TavilySearchSource', () => {
  let originalFetch: typeof fetch;
  let fetchMock: jest.Mock;
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env = { ...ORIGINAL_ENV };
    delete process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  // ── Interfaz ScraperSource ──────────────────────────────────────────────

  describe('ScraperSource shape', () => {
    it('expone id, name y enabled=true por defecto', () => {
      const src = new TavilySearchSource({ query: 'barranquilla cosas que hacer' });
      expect(src.id).toBe('tavily-search');
      expect(typeof src.name).toBe('string');
      expect(src.name.length).toBeGreaterThan(0);
      expect(src.enabled).toBe(true);
    });

    it('permite overrides de id / name / enabled', () => {
      const src = new TavilySearchSource({
        id: 'tavily-instagram',
        name: 'Tavily — Instagram BAQ',
        enabled: false,
        query: 'eventos barranquilla',
      });
      expect(src.id).toBe('tavily-instagram');
      expect(src.name).toBe('Tavily — Instagram BAQ');
      expect(src.enabled).toBe(false);
    });
  });

  // ── Mock data fallback (sin TAVILY_API_KEY) ─────────────────────────────

  describe('sin TAVILY_API_KEY (fallback a mock data)', () => {
    it('no llama a fetch — devuelve mock data', async () => {
      const src = new TavilySearchSource({ query: 'eventos barranquilla' });
      const items = await src.fetch();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(items.length).toBe(5);
    });

    it('los mock items cumplen con el shape de RawItem', async () => {
      const src = new TavilySearchSource({ query: 'eventos barranquilla' });
      const items = await src.fetch();
      for (const it of items) {
        expect(typeof it.external_id).toBe('string');
        expect(it.external_id.length).toBeGreaterThan(0);
        expect(typeof it.name).toBe('string');
        expect(it.name.length).toBeGreaterThan(0);
        expect(typeof it.source_url).toBe('string');
        // raw_payload debe traer marca de mock para que se note en debug.
        expect(it.raw_payload?.mock).toBe(true);
      }
    });

    it('cada mock item tiene external_id unico', async () => {
      const src = new TavilySearchSource({ query: 'q' });
      const items = await src.fetch();
      const ids = new Set(items.map((i) => i.external_id));
      expect(ids.size).toBe(items.length);
    });
  });

  // ── Llamada HTTP a Tavily ───────────────────────────────────────────────

  describe('con TAVILY_API_KEY (llamada real)', () => {
    beforeEach(() => {
      process.env.TAVILY_API_KEY = 'tvly-test-key';
    });

    it('hace POST a https://api.tavily.com/search', async () => {
      fetchMock.mockResolvedValue(okResponse({ results: [] }));

      const src = new TavilySearchSource({ query: 'eventos barranquilla' });
      await src.fetch();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.tavily.com/search');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['content-type']).toMatch(/application\/json/);
    });

    it('envia el body con api_key, query, search_depth=advanced, include_raw_content=true', async () => {
      fetchMock.mockResolvedValue(okResponse({ results: [] }));

      const src = new TavilySearchSource({
        query: 'cosas que hacer en barranquilla',
        max_results: 8,
      });
      await src.fetch();

      const body = bodyOfCall(fetchMock);
      expect(body.api_key).toBe('tvly-test-key');
      expect(body.query).toBe('cosas que hacer en barranquilla');
      expect(body.search_depth).toBe('advanced');
      expect(body.max_results).toBe(8);
      expect(body.include_answer).toBe(false);
      expect(body.include_raw_content).toBe(true);
    });

    it('respeta include_domains de la config', async () => {
      fetchMock.mockResolvedValue(okResponse({ results: [] }));

      const src = new TavilySearchSource({
        query: 'q',
        include_domains: ['instagram.com', 'facebook.com'],
      });
      await src.fetch();

      const body = bodyOfCall(fetchMock);
      expect(body.include_domains).toEqual(['instagram.com', 'facebook.com']);
    });

    it('no manda include_domains si la config no lo trae', async () => {
      fetchMock.mockResolvedValue(okResponse({ results: [] }));
      const src = new TavilySearchSource({ query: 'q' });
      await src.fetch();
      const body = bodyOfCall(fetchMock);
      expect(body.include_domains).toBeUndefined();
    });

    it('aplica max_results default = 10 si no se especifica', async () => {
      fetchMock.mockResolvedValue(okResponse({ results: [] }));
      const src = new TavilySearchSource({ query: 'q' });
      await src.fetch();
      const body = bodyOfCall(fetchMock);
      expect(body.max_results).toBe(10);
    });
  });

  // ── Parseo de la respuesta ──────────────────────────────────────────────

  describe('parseo de results a RawItem', () => {
    beforeEach(() => {
      process.env.TAVILY_API_KEY = 'tvly-test-key';
    });

    it('mapea url → source_url, title → name, content → description', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          results: [
            {
              url: 'https://www.instagram.com/p/ABC123/',
              title: 'Festival de Sabor — Barranquilla',
              content: 'Festival gastronomico en el Parque Cultural del Caribe.',
              raw_content: null,
              score: 0.92,
            },
          ],
        }),
      );

      const src = new TavilySearchSource({ query: 'festival barranquilla' });
      const items = await src.fetch();

      expect(items).toHaveLength(1);
      expect(items[0].source_url).toBe('https://www.instagram.com/p/ABC123/');
      expect(items[0].name).toBe('Festival de Sabor — Barranquilla');
      expect(items[0].description).toBe(
        'Festival gastronomico en el Parque Cultural del Caribe.',
      );
    });

    it('genera external_id estable basado en la url', async () => {
      // Cada llamada a fetch consume el body de Response, asi que devolvemos
      // una nueva Response por cada llamada.
      const buildResp = () =>
        okResponse({
          results: [
            { url: 'https://example.com/a', title: 'A', content: 'a' },
            { url: 'https://example.com/b', title: 'B', content: 'b' },
          ],
        });
      fetchMock.mockImplementation(async () => buildResp());

      const src = new TavilySearchSource({ query: 'q' });
      const items = await src.fetch();

      expect(items[0].external_id).toBeDefined();
      expect(items[1].external_id).toBeDefined();
      expect(items[0].external_id).not.toBe(items[1].external_id);
      // Mismo input → mismo external_id (idempotente).
      const items2 = await src.fetch();
      expect(items2[0].external_id).toBe(items[0].external_id);
    });

    it('extrae la primera imagen del raw_content (markdown ![alt](url))', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          results: [
            {
              url: 'https://example.com/post',
              title: 'Post',
              content: 'short',
              raw_content:
                'Algun texto. ![cover](https://cdn.example.com/img/cover.jpg) y mas texto.',
            },
          ],
        }),
      );

      const src = new TavilySearchSource({ query: 'q' });
      const items = await src.fetch();
      expect(items[0].raw_payload?.image).toBe('https://cdn.example.com/img/cover.jpg');
    });

    it('extrae la primera imagen del raw_content (tag <img src="...">)', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          results: [
            {
              url: 'https://example.com/post',
              title: 'Post',
              content: 'short',
              raw_content: '<div><img src="https://cdn.example.com/photo.png" alt="x"/></div>',
            },
          ],
        }),
      );

      const src = new TavilySearchSource({ query: 'q' });
      const items = await src.fetch();
      expect(items[0].raw_payload?.image).toBe('https://cdn.example.com/photo.png');
    });

    it('image es null si no se encuentra imagen en raw_content', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          results: [
            {
              url: 'https://example.com/post',
              title: 'Post',
              content: 'short',
              raw_content: 'puro texto sin imagenes',
            },
          ],
        }),
      );

      const src = new TavilySearchSource({ query: 'q' });
      const items = await src.fetch();
      expect(items[0].raw_payload?.image ?? null).toBeNull();
    });

    it('devuelve [] si Tavily responde con results vacios', async () => {
      fetchMock.mockResolvedValue(okResponse({ results: [] }));
      const src = new TavilySearchSource({ query: 'q' });
      const items = await src.fetch();
      expect(items).toEqual([]);
    });

    it('devuelve [] si la respuesta no trae results', async () => {
      fetchMock.mockResolvedValue(okResponse({}));
      const src = new TavilySearchSource({ query: 'q' });
      const items = await src.fetch();
      expect(items).toEqual([]);
    });

    it('descarta entries sin url o sin title (no son utilizables)', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          results: [
            { url: 'https://example.com/ok', title: 'OK', content: 'c' },
            { url: '', title: 'sin url', content: 'c' },
            { url: 'https://example.com/sin-titulo', title: '', content: 'c' },
            { title: 'sin url field', content: 'c' },
          ],
        }),
      );

      const src = new TavilySearchSource({ query: 'q' });
      const items = await src.fetch();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('OK');
    });
  });

  // ── Manejo de errores ───────────────────────────────────────────────────

  describe('manejo de errores', () => {
    beforeEach(() => {
      process.env.TAVILY_API_KEY = 'tvly-test-key';
    });

    it('tira un Error informativo si la respuesta es no-2xx', async () => {
      fetchMock.mockResolvedValue(errorResponse(401, { detail: 'Unauthorized' }));

      const src = new TavilySearchSource({ query: 'q' });
      await expect(src.fetch()).rejects.toThrow(/tavily/i);
    });

    it('propaga el error si fetch rechaza (network error)', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNRESET'));

      const src = new TavilySearchSource({ query: 'q' });
      await expect(src.fetch()).rejects.toThrow(/ECONNRESET|tavily/i);
    });

    it('tira Error si el body de respuesta no es JSON valido', async () => {
      fetchMock.mockResolvedValue(
        new Response('not json at all', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const src = new TavilySearchSource({ query: 'q' });
      await expect(src.fetch()).rejects.toThrow();
    });
  });
});
