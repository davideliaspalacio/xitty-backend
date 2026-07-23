import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { throwDbError } from '../../common/errors/throw-db-error';

import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { RecordImpressionDto } from './dto/record-impression.dto';
import {
  isPromotionWindowValid,
  normalizePromotionBoundary,
  normalizePromotionWindow,
} from './promotion-window.util';
import {
  buildInteractionTrackingFields,
  isBotUserAgent,
  isDuplicateInteractionError,
  TrackingContext,
} from '../metrics/interaction-tracking.util';

const TABLE = 'promotions';
const ACTIVE_VIEW = 'active_promotions';
const ACTIVE_HERO_VIEW = 'active_hero_promotions';
const PLACES_TABLE = 'places';
const INTERACTIONS_TABLE = 'microsite_interactions';

interface SupabaseError {
  message: string;
  code?: string;
}

interface SupabaseSingleResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

interface SupabaseListResult<T> {
  data: T[] | null;
  error: SupabaseError | null;
  count?: number | null;
}

export interface PromotionRow {
  id: string;
  place_id: string;
  title: string;
  description?: string | null;
  discount_percentage?: number | null;
  starts_at: string;
  ends_at: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PlaceSummaryRow {
  id: string;
  name: string;
  slug: string | null;
}

export interface ActivePromotionRow extends PromotionRow {
  places?: PlaceSummaryRow | null;
}

export interface HeroPromotionRow extends ActivePromotionRow {
  is_hero: boolean;
  hero_priority: number | null;
  hero_image_url: string | null;
}

interface PromotionLookupRow {
  id: string;
  place_id: string;
}

interface PromotionWindowRow {
  id: string;
  starts_at: string;
  ends_at: string;
}

interface PlaceOwnerRow {
  owner_id: string;
}

interface PromotionUpdates {
  title?: string;
  description?: string | null;
  discount_percentage?: number | null;
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
}

export interface PaginatedPromotions {
  data: ActivePromotionRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class PromotionsService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findActiveByPlace(placeId: string): Promise<PromotionRow[]> {
    const { data, error } = (await this.supabase
      .from(ACTIVE_VIEW)
      .select(
        'id, place_id, title, description, discount_percentage, starts_at, ends_at, is_active, created_at, updated_at',
      )
      .eq('place_id', placeId)
      .order('created_at', {
        ascending: false,
      })) as unknown as SupabaseListResult<PromotionRow>;

    if (error) throwDbError(error, 'PromotionsService');
    return data || [];
  }

  async findManageByPlace(
    placeId: string,
    userId: string,
    userRole: string,
  ): Promise<PromotionRow[]> {
    await this.assertOwnership(placeId, userId, userRole);

    const { data, error } = (await this.supabase
      .from(TABLE)
      .select(
        'id, place_id, title, description, discount_percentage, starts_at, ends_at, is_active, created_at, updated_at, is_hero, hero_priority, hero_image_url',
      )
      .eq('place_id', placeId)
      .order('created_at', {
        ascending: false,
      })) as unknown as SupabaseListResult<PromotionRow>;

    if (error) throwDbError(error, 'PromotionsService');
    return data || [];
  }

  // ── Hero ads ────────────────────────────────────────────────────

  /**
   * Returns the active hero rotation for the home slot #1.
   * Reads from the view `active_hero_promotions` (already filters by
   * is_hero, is_active, time window and ORDER BY hero_priority DESC).
   * We also enforce the order client-side to keep behavior deterministic
   * even if a future Supabase client strips the view's ORDER BY.
   */
  async getHero(): Promise<HeroPromotionRow[]> {
    const { data, error } = (await this.supabase
      .from(ACTIVE_HERO_VIEW)
      .select(
        'id, place_id, title, description, discount_percentage, starts_at, ends_at, is_active, is_hero, hero_priority, hero_image_url, places(id, name, slug)',
      )
      .order('hero_priority', { ascending: false })
      .order('ends_at', {
        ascending: false,
      })) as unknown as SupabaseListResult<HeroPromotionRow>;

    if (error) throwDbError(error, 'PromotionsService');
    return data || [];
  }

  /**
   * Records an ad impression for a hero promotion. Public endpoint —
   * `userId` is optional (anonymous home views are allowed).
   */
  async recordImpression(
    promoId: string,
    userId?: string,
    dto: RecordImpressionDto = {},
    context: TrackingContext = {},
  ): Promise<{ success: true }> {
    if (isBotUserAgent(context.userAgent)) return { success: true };

    const { data: promo, error: lookupError } = (await this.supabase
      .from(TABLE)
      .select('id, place_id')
      .eq('id', promoId)
      .maybeSingle()) as unknown as SupabaseSingleResult<PromotionLookupRow>;

    if (lookupError) throwDbError(lookupError, 'PromotionsService');
    if (!promo) throw new NotFoundException('Promotion not found');

    const trackingFields = buildInteractionTrackingFields({
      placeId: promo.place_id,
      interactionType: 'ad_impression',
      promoId: promo.id,
      userId: userId ?? null,
      anonymousSessionId: dto.anonymous_session_id,
      userAgent: context.userAgent,
    });

    const { error } = (await this.supabase.from(INTERACTIONS_TABLE).insert({
      place_id: promo.place_id,
      user_id: userId ?? null,
      interaction_type: 'ad_impression',
      promo_id: promo.id,
      ...trackingFields,
    })) as unknown as SupabaseSingleResult<unknown>;

    if (error && isDuplicateInteractionError(error)) return { success: true };
    if (error) throwDbError(error, 'PromotionsService');
    return { success: true };
  }

  async findAllActive(page = 1, limit = 10): Promise<PaginatedPromotions> {
    const offset = (page - 1) * limit;

    const { data, error, count } = (await this.supabase
      .from(ACTIVE_VIEW)
      .select(
        'id, place_id, title, description, discount_percentage, starts_at, ends_at, places(id, name, slug)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(
        offset,
        offset + limit - 1,
      )) as unknown as SupabaseListResult<ActivePromotionRow>;

    if (error) throwDbError(error, 'PromotionsService');

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async create(
    placeId: string,
    userId: string,
    userRole: string,
    dto: CreatePromotionDto,
  ): Promise<PromotionRow> {
    await this.assertOwnership(placeId, userId, userRole);
    const normalized = normalizePromotionWindow(dto);

    if (!isPromotionWindowValid(normalized.starts_at, normalized.ends_at)) {
      throw new BadRequestException('ends_at must be after starts_at');
    }

    const { data, error } = (await this.supabase
      .from(TABLE)
      .insert({
        place_id: placeId,
        title: normalized.title,
        description: normalized.description,
        discount_percentage: normalized.discount_percentage,
        starts_at: normalized.starts_at,
        ends_at: normalized.ends_at,
        is_active: normalized.is_active ?? true,
      })
      .select('*')
      .single()) as unknown as SupabaseSingleResult<PromotionRow>;

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'Could not create promotion',
      );
    }

    // TODO: encolar notificacion a usuarios cercanos cuando exista
    // infraestructura push (US-024 ultimo criterio)

    return data;
  }

  async update(
    placeId: string,
    promotionId: string,
    userId: string,
    userRole: string,
    dto: UpdatePromotionDto,
  ): Promise<PromotionRow> {
    await this.assertOwnership(placeId, userId, userRole);

    const updates: PromotionUpdates = {};
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.discount_percentage !== undefined) {
      updates.discount_percentage = dto.discount_percentage;
    }
    if (dto.starts_at !== undefined) updates.starts_at = dto.starts_at;
    if (dto.ends_at !== undefined) updates.ends_at = dto.ends_at;
    if (dto.is_active !== undefined) updates.is_active = dto.is_active;

    if (typeof updates.starts_at === 'string') {
      updates.starts_at = normalizePromotionBoundary(
        updates.starts_at,
        'start',
      );
    }
    if (typeof updates.ends_at === 'string') {
      updates.ends_at = normalizePromotionBoundary(updates.ends_at, 'end');
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const { data: existing, error: lookupError } = (await this.supabase
      .from(TABLE)
      .select('id, starts_at, ends_at')
      .eq('id', promotionId)
      .eq('place_id', placeId)
      .maybeSingle()) as unknown as SupabaseSingleResult<PromotionWindowRow>;

    if (lookupError) throwDbError(lookupError, 'PromotionsService');
    if (!existing) throw new NotFoundException('Promotion not found');

    const nextStartsAt = updates.starts_at ?? existing.starts_at;
    const nextEndsAt = updates.ends_at ?? existing.ends_at;
    if (!isPromotionWindowValid(nextStartsAt, nextEndsAt)) {
      throw new BadRequestException('ends_at must be after starts_at');
    }

    const { data, error } = (await this.supabase
      .from(TABLE)
      .update(updates)
      .eq('id', promotionId)
      .eq('place_id', placeId)
      .select('*')
      .single()) as unknown as SupabaseSingleResult<PromotionRow>;

    if (error || !data) throw new NotFoundException('Promotion not found');
    return data;
  }

  async remove(
    placeId: string,
    promotionId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    await this.assertOwnership(placeId, userId, userRole);

    const { error } = await this.supabase
      .from(TABLE)
      .delete()
      .eq('id', promotionId)
      .eq('place_id', placeId);

    if (error) throwDbError(error, 'PromotionsService');
  }

  private async assertOwnership(
    placeId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    if (userRole === 'admin') return;

    const { data: place } = (await this.supabase
      .from(PLACES_TABLE)
      .select('owner_id')
      .eq('id', placeId)
      .maybeSingle()) as unknown as SupabaseSingleResult<PlaceOwnerRow>;

    if (!place) throw new NotFoundException('Place not found');
    if (place.owner_id !== userId) {
      throw new ForbiddenException(
        'You can only manage promotions of your own places',
      );
    }
  }
}
