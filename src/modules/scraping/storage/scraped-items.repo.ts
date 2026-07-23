import { createHash } from 'crypto';
import { throwDbError } from '../../../common/errors/throw-db-error';

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import type { SourceReview } from '../scraper-source.interface';

const RAW_TABLE = 'scraped_items_raw';
const ENRICHED_TABLE = 'scraped_items_enriched';

// Codigo Postgres para violacion de unique constraint
const PG_UNIQUE_VIOLATION = '23505';

interface PostgresError {
  code?: string;
  message?: string;
}

export type EnrichedStatus = 'pending' | 'approved' | 'rejected' | 'published';

// ── Inputs ──────────────────────────────────────────────────────────────────

export interface InsertRawInput {
  runId: string;
  sourceId: string;
  sourceUrl: string;
  sourceExternalId?: string | null;
  payload: Record<string, any>;
}

export interface InsertEnrichedInput {
  rawId: string;
  title: string;
  description?: string | null;
  categoryHint?: string | null;
  locationName?: string | null;
  lat?: number | null;
  lng?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  priceCop?: number | null;
  imageUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  phone?: string | null;
  website?: string | null;
  openingHours?: string[] | null;
  priceLevel?: number | null;
  city?: string | null;
  zone?: string | null;
  sourceKind?: string | null;
  sourceExternalId?: string | null;
  sourceReviews?: SourceReview[] | null;
  sourceUrl?: string | null;
  qualityScore?: number | null;
}

export interface ListPendingOptions {
  limit: number;
  offset: number;
}

export interface ListByStatusOptions {
  status: EnrichedStatus;
  limit: number;
  offset: number;
}

export interface UpdateEnrichedFields {
  title?: string;
  description?: string | null;
  category_hint?: string | null;
  location_name?: string | null;
  lat?: number | null;
  lng?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  price_cop?: number | null;
}

export interface PublishInput {
  placeId?: string;
  experienceId?: string;
}

// ── Row types ───────────────────────────────────────────────────────────────

export interface ScrapedItemRaw {
  id: string;
  run_id: string;
  source_id: string;
  source_url: string;
  source_external_id: string | null;
  raw_payload: Record<string, any>;
  dedup_hash: string;
  scraped_at: string;
}

export interface ScrapedItemEnriched {
  id: string;
  raw_id: string;
  title: string;
  description: string | null;
  category_hint: string | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  starts_at: string | null;
  ends_at: string | null;
  price_cop: number | null;
  image_url: string | null;
  rating: number | null;
  review_count: number | null;
  phone: string | null;
  website: string | null;
  opening_hours: string[] | null;
  price_level: number | null;
  city: string | null;
  zone: string | null;
  source_kind: string | null;
  source_external_id: string | null;
  source_reviews: SourceReview[] | null;
  source_url: string | null;
  quality_score: number | null;
  status: EnrichedStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  published_place_id: string | null;
  published_experience_id: string | null;
  created_at: string;
  updated_at: string;
}

const RAW_COLS =
  'id, run_id, source_id, source_url, source_external_id, raw_payload, dedup_hash, scraped_at';

const ENRICHED_COLS =
  'id, raw_id, title, description, category_hint, location_name, lat, lng, ' +
  'starts_at, ends_at, price_cop, image_url, rating, review_count, ' +
  'phone, website, opening_hours, price_level, city, zone, source_kind, source_external_id, source_reviews, source_url, ' +
  'quality_score, status, ' +
  'reviewed_by, reviewed_at, rejection_reason, published_place_id, published_experience_id, ' +
  'created_at, updated_at';

@Injectable()
export class ScrapedItemsRepo {
  private readonly logger = new Logger(ScrapedItemsRepo.name);

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Raw layer
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Hash deterministico para deduplicar items. Usa source_id + external_id +
   * source_url. NO usa el payload porque queremos que el mismo item, aunque
   * la fuente cambie campos no esenciales, se siga viendo como duplicado.
   */
  computeDedupHash(
    sourceId: string,
    sourceUrl: string,
    sourceExternalId?: string | null,
  ): string {
    const key = `${sourceId}|${sourceExternalId ?? ''}|${sourceUrl}`;
    return createHash('sha256').update(key).digest('hex');
  }

  async insertRaw(input: InsertRawInput): Promise<ScrapedItemRaw | null> {
    const dedupHash = this.computeDedupHash(
      input.sourceId,
      input.sourceUrl,
      input.sourceExternalId ?? null,
    );

    const row = {
      run_id: input.runId,
      source_id: input.sourceId,
      source_url: input.sourceUrl,
      source_external_id: input.sourceExternalId ?? null,
      raw_payload: input.payload,
      dedup_hash: dedupHash,
    };

    const { data, error } = await this.supabase
      .from(RAW_TABLE)
      .insert(row)
      .select(RAW_COLS)
      .single();

    if (error) {
      // dedup collision → no es un error, es comportamiento esperado
      if ((error as PostgresError).code === PG_UNIQUE_VIOLATION) {
        this.logger.debug(
          `dedup hit for ${input.sourceUrl} (run=${input.runId})`,
        );
        return null;
      }
      throwDbError(error, 'ScrapedItemsRepo');
    }
    return data as unknown as ScrapedItemRaw;
  }

  async dedupCheck(dedupHash: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(RAW_TABLE)
      .select('id')
      .eq('dedup_hash', dedupHash)
      .maybeSingle();

    if (error) throwDbError(error, 'ScrapedItemsRepo');
    return !!data;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Enriched layer
  // ─────────────────────────────────────────────────────────────────────────

  async insertEnriched(
    input: InsertEnrichedInput,
  ): Promise<ScrapedItemEnriched> {
    const row = {
      raw_id: input.rawId,
      title: input.title,
      description: input.description ?? null,
      category_hint: input.categoryHint ?? null,
      location_name: input.locationName ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      price_cop: input.priceCop ?? null,
      image_url: input.imageUrl ?? null,
      rating: input.rating ?? null,
      review_count: input.reviewCount ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      opening_hours: input.openingHours ?? null,
      price_level: input.priceLevel ?? null,
      city: input.city ?? null,
      zone: input.zone ?? null,
      source_kind: input.sourceKind ?? null,
      source_external_id: input.sourceExternalId ?? null,
      source_reviews: input.sourceReviews ?? null,
      source_url: input.sourceUrl ?? null,
      quality_score: input.qualityScore ?? null,
      status: 'pending' as EnrichedStatus,
    };

    const { data, error } = await this.supabase
      .from(ENRICHED_TABLE)
      .insert(row)
      .select(ENRICHED_COLS)
      .single();

    if (error) throwDbError(error, 'ScrapedItemsRepo');
    if (!data) {
      throw new BadRequestException('No se pudo guardar el enriched item');
    }
    return data as unknown as ScrapedItemEnriched;
  }

  async listPending(opts: ListPendingOptions): Promise<ScrapedItemEnriched[]> {
    return this.listByStatus({ ...opts, status: 'pending' });
  }

  /**
   * Variante general usada por el panel admin: lista por cualquier status
   * con paginacion por offset/limit. Orden por mas reciente primero.
   */
  async listByStatus(
    opts: ListByStatusOptions,
  ): Promise<ScrapedItemEnriched[]> {
    const limit = Math.max(1, Math.min(opts.limit, 200));
    const offset = Math.max(0, opts.offset);

    const { data, error } = await this.supabase
      .from(ENRICHED_TABLE)
      .select(ENRICHED_COLS)
      .eq('status', opts.status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throwDbError(error, 'ScrapedItemsRepo');
    return (data ?? []) as unknown as ScrapedItemEnriched[];
  }

  async findById(id: string): Promise<ScrapedItemEnriched> {
    const { data, error } = await this.supabase
      .from(ENRICHED_TABLE)
      .select(ENRICHED_COLS)
      .eq('id', id)
      .maybeSingle();

    if (error) throwDbError(error, 'ScrapedItemsRepo');
    if (!data) {
      throw new NotFoundException(`Enriched item ${id} not found`);
    }
    return data as unknown as ScrapedItemEnriched;
  }

  /**
   * PATCH parcial usado desde el panel de moderacion. Solo modifica los
   * campos presentables — NO toca `status`, `published_*` ni `reviewed_*`
   * (esos se gestionan via approve/reject/publish).
   */
  async updateFields(
    id: string,
    fields: UpdateEnrichedFields,
  ): Promise<ScrapedItemEnriched> {
    const updates: Record<string, any> = {};
    const allowed: (keyof UpdateEnrichedFields)[] = [
      'title',
      'description',
      'category_hint',
      'location_name',
      'lat',
      'lng',
      'starts_at',
      'ends_at',
      'price_cop',
    ];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates[key] = fields[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      throw new BadRequestException(
        'updateFields requiere al menos un campo editable',
      );
    }
    return this.transition(id, updates);
  }

  // ─── Moderation ────────────────────────────────────────────────────────────

  async approve(id: string, reviewerId: string): Promise<ScrapedItemEnriched> {
    return this.transition(id, {
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    });
  }

  async reject(
    id: string,
    reviewerId: string,
    reason?: string,
  ): Promise<ScrapedItemEnriched> {
    const patch: Record<string, any> = {
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    };
    if (reason !== undefined) {
      patch.rejection_reason = reason;
    }
    return this.transition(id, patch);
  }

  async publish(id: string, input: PublishInput): Promise<ScrapedItemEnriched> {
    if (!input.placeId && !input.experienceId) {
      throw new BadRequestException('publish requiere placeId o experienceId');
    }

    return this.transition(id, {
      status: 'published',
      published_place_id: input.placeId ?? null,
      published_experience_id: input.experienceId ?? null,
    });
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  /**
   * 1) verifica que el item existe (404 si no), 2) update con `patch`.
   * No valida transiciones — el caller decide (admin puede approve→rejected, etc).
   */
  private async transition(
    id: string,
    patch: Record<string, any>,
  ): Promise<ScrapedItemEnriched> {
    const { data: existing, error: fetchErr } = await this.supabase
      .from(ENRICHED_TABLE)
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throwDbError(fetchErr, 'ScrapedItemsRepo');
    if (!existing) {
      throw new NotFoundException(`Enriched item ${id} not found`);
    }

    const { data, error } = await this.supabase
      .from(ENRICHED_TABLE)
      .update(patch)
      .eq('id', id)
      .select(ENRICHED_COLS)
      .single();

    if (error) throwDbError(error, 'ScrapedItemsRepo');
    if (!data) {
      throw new BadRequestException('No se pudo actualizar el enriched item');
    }
    return data as unknown as ScrapedItemEnriched;
  }
}
