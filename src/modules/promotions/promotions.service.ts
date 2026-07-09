import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { RecordImpressionDto } from './dto/record-impression.dto';
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

@Injectable()
export class PromotionsService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findActiveByPlace(placeId: string) {
    const { data, error } = await this.supabase
      .from(ACTIVE_VIEW)
      .select(
        'id, place_id, title, description, discount_percentage, starts_at, ends_at, is_active, created_at, updated_at',
      )
      .eq('place_id', placeId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
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
  async getHero() {
    const { data, error } = await this.supabase
      .from(ACTIVE_HERO_VIEW)
      .select(
        'id, place_id, title, description, discount_percentage, starts_at, ends_at, is_active, is_hero, hero_priority, hero_image_url, places(id, name, slug)',
      )
      .order('hero_priority', { ascending: false })
      .order('ends_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
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
  ) {
    if (isBotUserAgent(context.userAgent)) return { success: true };

    const { data: promo, error: lookupError } = await this.supabase
      .from(TABLE)
      .select('id, place_id')
      .eq('id', promoId)
      .maybeSingle();

    if (lookupError) throw new BadRequestException(lookupError.message);
    if (!promo) throw new NotFoundException('Promotion not found');

    const trackingFields = buildInteractionTrackingFields({
      placeId: promo.place_id,
      interactionType: 'ad_impression',
      promoId: promo.id,
      userId: userId ?? null,
      anonymousSessionId: dto.anonymous_session_id,
      userAgent: context.userAgent,
    });

    const { error } = await this.supabase.from(INTERACTIONS_TABLE).insert({
      place_id: promo.place_id,
      user_id: userId ?? null,
      interaction_type: 'ad_impression',
      promo_id: promo.id,
      ...trackingFields,
    });

    if (error && isDuplicateInteractionError(error)) return { success: true };
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async findAllActive(page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase
      .from(ACTIVE_VIEW)
      .select(
        'id, place_id, title, description, discount_percentage, starts_at, ends_at, places(id, name, slug)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);

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
  ) {
    await this.assertOwnership(placeId, userId, userRole);

    if (new Date(dto.ends_at) <= new Date(dto.starts_at)) {
      throw new BadRequestException('ends_at must be after starts_at');
    }

    const { data, error } = await this.supabase
      .from(TABLE)
      .insert({
        place_id: placeId,
        title: dto.title,
        description: dto.description,
        discount_percentage: dto.discount_percentage,
        starts_at: dto.starts_at,
        ends_at: dto.ends_at,
        is_active: dto.is_active ?? true,
      })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);

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
  ) {
    await this.assertOwnership(placeId, userId, userRole);

    if (
      dto.starts_at &&
      dto.ends_at &&
      new Date(dto.ends_at) <= new Date(dto.starts_at)
    ) {
      throw new BadRequestException('ends_at must be after starts_at');
    }

    const updates: Record<string, any> = {};
    const fields = [
      'title',
      'description',
      'discount_percentage',
      'starts_at',
      'ends_at',
      'is_active',
    ] as const;
    for (const k of fields) {
      if ((dto as any)[k] !== undefined) updates[k] = (dto as any)[k];
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const { data, error } = await this.supabase
      .from(TABLE)
      .update(updates)
      .eq('id', promotionId)
      .eq('place_id', placeId)
      .select('*')
      .single();

    if (error || !data) throw new NotFoundException('Promotion not found');
    return data;
  }

  async remove(
    placeId: string,
    promotionId: string,
    userId: string,
    userRole: string,
  ) {
    await this.assertOwnership(placeId, userId, userRole);

    const { error } = await this.supabase
      .from(TABLE)
      .delete()
      .eq('id', promotionId)
      .eq('place_id', placeId);

    if (error) throw new BadRequestException(error.message);
  }

  private async assertOwnership(
    placeId: string,
    userId: string,
    userRole: string,
  ) {
    if (userRole === 'admin') return;

    const { data: place } = await this.supabase
      .from(PLACES_TABLE)
      .select('owner_id')
      .eq('id', placeId)
      .maybeSingle();

    if (!place) throw new NotFoundException('Place not found');
    if (place.owner_id !== userId) {
      throw new ForbiddenException(
        'You can only manage promotions of your own places',
      );
    }
  }
}
