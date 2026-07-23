import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { throwDbError } from '../../../common/errors/throw-db-error';

import {
  CuratedItemCardDto,
  CuratedItemDetailDto,
  SourceReviewDto,
} from './dto/curated-item.dto';

const ENRICHED_TABLE = 'scraped_items_enriched';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const CARD_SELECT =
  'id, title, description, category_hint, location_name, lat, lng, ' +
  'price_cop, image_url, starts_at, ends_at, quality_score, created_at';

// El detalle ademas incluye source_url y joina con scraped_items_raw para
// sacar scraped_at (la columna autoritativa del timestamp de scraping).
const DETAIL_SELECT =
  'id, title, description, category_hint, location_name, lat, lng, ' +
  'price_cop, image_url, starts_at, ends_at, quality_score, source_url, ' +
  'source_reviews, created_at, scraped_items_raw(scraped_at)';

export interface FindCuratedOptions {
  limit?: number;
  category?: string;
}

interface SupabaseError {
  message: string;
}

interface SupabaseListResult<T> {
  data: T[] | null;
  error: SupabaseError | null;
}

interface SupabaseSingleResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

interface CuratedItemRow {
  id: string;
  title: string;
  description: string | null;
  category_hint: string | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  price_cop: number | null;
  image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  quality_score: number | string | null;
  created_at: string;
}

interface RawJoinRow {
  scraped_at: string | null;
}

interface CuratedItemDetailRow extends CuratedItemRow {
  source_url: string | null;
  source_reviews: SourceReviewDto[] | null;
  scraped_at?: string | null;
  scraped_items_raw?: RawJoinRow | RawJoinRow[] | null;
}

/**
 * DiscoverService — feed publico de items curados del pipeline de scraping.
 *
 * Solo expone items con `status='published'` (los que pasaron moderacion).
 * RLS en Supabase ya impone esto, pero replicamos el filtro en la query
 * para no depender exclusivamente de RLS desde el backend (que usa
 * service-role-key y la bypassea).
 */
@Injectable()
export class DiscoverService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Lista paginada de items curados, ordenados por calidad y recencia.
   * Acepta filtro opcional por `category` (matchea `category_hint`).
   */
  async findCurated(opts: FindCuratedOptions): Promise<CuratedItemCardDto[]> {
    const limit = this.normalizeLimit(opts.limit);

    let qb = this.supabase
      .from(ENRICHED_TABLE)
      .select(CARD_SELECT)
      .eq('status', 'published');

    if (opts.category) {
      qb = qb.eq('category_hint', opts.category);
    }

    qb = qb
      .order('quality_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(0, limit - 1);

    const { data, error } =
      (await qb) as unknown as SupabaseListResult<CuratedItemRow>;
    if (error) throwDbError(error, 'DiscoverService');

    return (data ?? []).map((row) => this.toCard(row));
  }

  /**
   * Detalle de un item curado. 404 si no existe o no esta publicado.
   */
  async findCuratedById(id: string): Promise<CuratedItemDetailDto> {
    const { data, error } = (await this.supabase
      .from(ENRICHED_TABLE)
      .select(DETAIL_SELECT)
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle()) as unknown as SupabaseSingleResult<CuratedItemDetailRow>;

    if (error) throwDbError(error, 'DiscoverService');
    if (!data) throw new NotFoundException(`Curated item ${id} not found`);

    return this.toDetail(data);
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private normalizeLimit(raw?: number): number {
    if (raw === undefined || raw === null || Number.isNaN(Number(raw))) {
      return DEFAULT_LIMIT;
    }
    const n = Math.trunc(Number(raw));
    if (n < 1) return 1;
    if (n > MAX_LIMIT) return MAX_LIMIT;
    return n;
  }

  private toCard(row: CuratedItemRow): CuratedItemCardDto {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      category: row.category_hint ?? null,
      location_name: row.location_name ?? null,
      latitude: row.lat ?? null,
      longitude: row.lng ?? null,
      price_cop: row.price_cop ?? null,
      image_url: row.image_url ?? null,
      starts_at: row.starts_at ?? null,
      ends_at: row.ends_at ?? null,
      quality_score: Number(row.quality_score ?? 0),
    };
  }

  private toDetail(row: CuratedItemDetailRow): CuratedItemDetailDto {
    // El join con scraped_items_raw devuelve un objeto (FK 1-1) o null.
    // Supabase a veces lo devuelve como array — soportamos ambos.
    const rawJoin = Array.isArray(row.scraped_items_raw)
      ? row.scraped_items_raw[0]
      : row.scraped_items_raw;

    const scrapedAt = rawJoin?.scraped_at ?? row.scraped_at ?? row.created_at;

    return {
      ...this.toCard(row),
      source_url: row.source_url ?? null,
      scraped_at: scrapedAt,
      source_reviews: row.source_reviews ?? null,
    };
  }
}
