import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';

import { RawItem, ScraperSource } from '../scraper-source.interface';

/**
 * Configuracion de una instancia de TavilySearchSource.
 *
 * El constructor recibe esta config porque queremos poder registrar
 * VARIAS instancias en el SchedulerModule (una por query / vertical):
 *   - tavily-instagram-eventos
 *   - tavily-facebook-restaurantes
 *   - tavily-news-cultura
 *
 * Cada instancia tiene su propio id y su propia config de query.
 */
export interface TavilySearchSourceConfig {
  /** Identificador de la source en el sistema. Default: 'tavily-search'. */
  id?: string;
  /** Nombre humano para logs/UI. Default derivado de la query. */
  name?: string;
  /** `false` desactiva la source del runAll(). Default: true. */
  enabled?: boolean;

  /** Query de busqueda (requerida) — lo que se le pide a Tavily. */
  query: string;
  /** Cantidad maxima de resultados. Default 10 (max recomendado por Tavily). */
  max_results?: number;
  /** Restringe la busqueda a estos dominios (ej. ['instagram.com', 'facebook.com']). */
  include_domains?: string[];
}

/** Endpoint oficial de Tavily Search API (https://docs.tavily.com). */
const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

/**
 * Source que usa la **Tavily Search API** para descubrir contenido en la web
 * (Instagram, Facebook, blogs, news, etc.).
 *
 * REGLA del proyecto: si `TAVILY_API_KEY` no esta en el entorno, NO falla —
 * devuelve 5 mock entries. Esto permite correr el pipeline localmente sin
 * credenciales.
 *
 * El parseo de la respuesta saca:
 *   - source_url  ← result.url
 *   - name        ← result.title
 *   - description ← result.content (snippet de Tavily)
 *   - raw_payload.image ← primera imagen detectada en result.raw_content
 *     (markdown ![](...) o tag <img src="...">)
 */
export class TavilySearchSource implements ScraperSource {
  private readonly logger = new Logger(TavilySearchSource.name);

  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;

  constructor(private readonly config: TavilySearchSourceConfig) {
    this.id = config.id ?? 'tavily-search';
    this.name = config.name ?? `Tavily Search — ${config.query}`;
    this.enabled = config.enabled ?? true;
  }

  async fetch(): Promise<RawItem[]> {
    const apiKey = process.env.TAVILY_API_KEY;

    // Fallback obligatorio: sin API key, devolvemos mock data en lugar de
    // tirar excepcion. Asi el pipeline corre en dev y CI sin credenciales.
    if (!apiKey) {
      this.logger.warn(
        `[${this.id}] TAVILY_API_KEY no configurada — devolviendo mock data`,
      );
      return this.mockResults();
    }

    const body = this.buildRequestBody(apiKey);

    let res: Response;
    try {
      res = await fetch(TAVILY_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      // Network-level error (DNS, conexion, timeout) — relanzar con contexto.
      throw new Error(
        `Tavily request failed: ${err?.message ?? 'unknown network error'}`,
      );
    }

    if (!res.ok) {
      // Intentamos leer el body para meterlo en el mensaje — Tavily devuelve
      // { detail: '...' } o { error: '...' } segun el caso.
      let detail = '';
      try {
        const text = await res.text();
        detail = text.slice(0, 300);
      } catch {
        // ignore
      }
      throw new Error(
        `Tavily responded ${res.status} ${res.statusText}${detail ? `: ${detail}` : ''}`,
      );
    }

    let payload: TavilyResponse;
    try {
      payload = (await res.json()) as TavilyResponse;
    } catch (err: any) {
      throw new Error(
        `Tavily response was not valid JSON: ${err?.message ?? 'parse error'}`,
      );
    }

    const results = Array.isArray(payload?.results) ? payload.results : [];
    return results
      .filter((r) => typeof r?.url === 'string' && r.url.length > 0)
      .filter((r) => typeof r?.title === 'string' && r.title.length > 0)
      .map((r) => this.toRawItem(r));
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private buildRequestBody(apiKey: string): Record<string, unknown> {
    const body: Record<string, unknown> = {
      api_key: apiKey,
      query: this.config.query,
      search_depth: 'advanced',
      max_results: this.config.max_results ?? 10,
      include_answer: false,
      include_raw_content: true,
    };
    if (this.config.include_domains && this.config.include_domains.length > 0) {
      body.include_domains = this.config.include_domains;
    }
    return body;
  }

  private toRawItem(result: TavilyResult): RawItem {
    const image = extractFirstImage(result.raw_content ?? null);
    return {
      external_id: stableIdFromUrl(result.url),
      name: result.title,
      description: result.content ?? null,
      source_url: result.url,
      raw_payload: {
        score: result.score ?? null,
        image: image ?? null,
        query: this.config.query,
      },
    };
  }

  /**
   * Mock data — se usa cuando no hay TAVILY_API_KEY. Los items llevan la
   * marca `raw_payload.mock = true` para que sean facilmente identificables
   * en debug / dashboards.
   */
  private mockResults(): RawItem[] {
    const samples = [
      {
        url: 'https://www.instagram.com/p/mock-festival-sabor/',
        title: 'Festival del Sabor en el Parque Cultural del Caribe',
        content:
          'Festival gastronomico con cocineros locales en el Parque Cultural del Caribe, Barranquilla. Entrada libre.',
        image:
          'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=800',
      },
      {
        url: 'https://www.facebook.com/events/mock-carnaval-veranillo/',
        title: 'Carnaval del Veranillo — Vía 40',
        content:
          'Comparsas y musica en vivo en la Vía 40 durante el fin de semana del Carnaval.',
        image:
          'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800',
      },
      {
        url: 'https://elheraldo.co/mock/mejores-restaurantes-baq',
        title: 'Los 10 mejores restaurantes de Barranquilla en 2026',
        content:
          'Recorrido por los restaurantes con mejor calificacion en Barranquilla este año, segun criticos locales.',
        image:
          'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
      },
      {
        url: 'https://www.instagram.com/p/mock-malecon-atardecer/',
        title: 'Atardecer en el Malecon del Río',
        content:
          'Cientos de personas se reunen cada tarde en el Malecon del Río para ver el atardecer sobre el Magdalena.',
        image:
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
      },
      {
        url: 'https://www.instagram.com/p/mock-museo-caribe/',
        title: 'Exposicion temporal en el Museo del Caribe',
        content:
          'El Museo del Caribe abre una nueva exposicion sobre la cultura afro-caribe colombiana.',
        image:
          'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=800',
      },
    ];
    return samples.map((s) => ({
      external_id: stableIdFromUrl(s.url),
      name: s.title,
      description: s.content,
      source_url: s.url,
      raw_payload: {
        mock: true,
        image: s.image,
        query: this.config.query,
      },
    }));
  }
}

// ── Shape de la respuesta de Tavily (solo los campos que usamos). ────────

interface TavilyResult {
  url: string;
  title: string;
  content?: string | null;
  raw_content?: string | null;
  score?: number | null;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

// ── Helpers de modulo ────────────────────────────────────────────────────

/**
 * Genera un external_id estable a partir de una URL. Usamos sha1(url) en hex
 * truncado a 16 chars — suficientemente unico para una source y mas corto
 * que la url completa.
 */
function stableIdFromUrl(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 16);
}

/**
 * Extrae la primera URL de imagen que aparezca en `raw_content`. Detecta:
 *   - Markdown: ![alt](https://...png)
 *   - HTML tag:  <img src="https://..." ...>
 * Devuelve `null` si no encuentra nada.
 */
function extractFirstImage(raw: string | null): string | null {
  if (!raw) return null;

  // Markdown ![alt](url) — capturamos hasta el primer espacio o ')'
  const md = raw.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)/i);
  if (md && md[1]) return md[1];

  // HTML <img src="..."> o <img src='...'>
  const html = raw.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  if (html && html[1]) return html[1];

  return null;
}
