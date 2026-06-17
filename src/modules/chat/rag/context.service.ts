import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { PlaceSnippet } from '../providers/chat-provider.interface';

/**
 * Keywords -> slugs de categoria conocidos.
 * El mapping coincide con los slugs sembrados en
 * supabase/migrations/20260413000001_create_categories_and_places.sql
 */
export const CHAT_KEYWORD_TO_CATEGORY_SLUG: Record<string, string> = {
  restaurante: 'restaurantes',
  restaurantes: 'restaurantes',
  comer: 'restaurantes',
  comida: 'restaurantes',
  playa: 'playas',
  playas: 'playas',
  hotel: 'hoteles',
  hoteles: 'hoteles',
  hospedaje: 'hoteles',
  bar: 'bares-vida-nocturna',
  bares: 'bares-vida-nocturna',
  discoteca: 'bares-vida-nocturna',
  noche: 'bares-vida-nocturna',
  museo: 'cultura',
  museos: 'cultura',
  cultura: 'cultura',
  tour: 'experiencias',
  tours: 'experiencias',
  experiencia: 'experiencias',
  experiencias: 'experiencias',
};

@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Extrae keywords del texto y retorna los slugs de categoria coincidentes.
   * Devuelve [] si no hay match.
   */
  extractEntities(text: string): string[] {
    if (!text) return [];
    const lower = text.toLowerCase();
    const slugs = new Set<string>();
    for (const [keyword, slug] of Object.entries(CHAT_KEYWORD_TO_CATEGORY_SLUG)) {
      // Word boundary simple: o esta solo o rodeado por non-letters (incluye acentos).
      const pattern = new RegExp(`(^|[^a-záéíóúñ])${keyword}([^a-záéíóúñ]|$)`, 'i');
      if (pattern.test(lower)) {
        slugs.add(slug);
      }
    }
    return Array.from(slugs);
  }

  /**
   * Dado un texto del usuario, retorna hasta 5 places mejor rankeados que
   * caen en las categorias detectadas. Retorna [] si no hay keywords match.
   */
  async getSnippetsFor(text: string, limit = 5): Promise<PlaceSnippet[]> {
    const slugs = this.extractEntities(text);
    if (slugs.length === 0) return [];

    try {
      // 1) buscar ids de categoria por slug
      const { data: cats, error: catErr } = await this.supabase
        .from('categories')
        .select('id, slug, name')
        .in('slug', slugs);

      if (catErr || !cats || cats.length === 0) {
        if (catErr) this.logger.warn(`Categories lookup failed: ${catErr.message}`);
        return [];
      }

      const categoryIds = cats.map((c: any) => c.id);
      const catBySlug: Record<string, string> = {};
      const catNameById: Record<string, string> = {};
      for (const c of cats as any[]) {
        catBySlug[c.slug] = c.id;
        catNameById[c.id] = c.name;
      }

      // 2) buscar top places en esas categorias por average_rating DESC
      const { data: places, error: placeErr } = await this.supabase
        .from('places')
        .select(
          'id, name, description, address, category_id, average_rating, price_range',
        )
        .in('category_id', categoryIds)
        .eq('is_active', true)
        .order('average_rating', { ascending: false })
        .limit(limit);

      if (placeErr || !places) {
        if (placeErr) this.logger.warn(`Places lookup failed: ${placeErr.message}`);
        return [];
      }

      return (places as any[]).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        category: catNameById[p.category_id] ?? null,
        address: p.address ?? null,
        average_rating: p.average_rating ?? null,
        price_range: p.price_range ?? null,
      }));
    } catch (err: any) {
      this.logger.warn(`getSnippetsFor error: ${err?.message ?? 'unknown'}`);
      return [];
    }
  }
}
