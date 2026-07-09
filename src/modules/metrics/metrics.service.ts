import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { TrackInteractionDto } from './dto/track-interaction.dto';
import { TimeseriesGranularity } from './dto/metrics-timeseries.dto';
import {
  buildInteractionTrackingFields,
  isBotUserAgent,
  isDuplicateInteractionError,
  TrackingContext,
} from './interaction-tracking.util';

const TABLE = 'microsite_interactions';
const PLACES_TABLE = 'places';

@Injectable()
export class MetricsService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async track(
    placeId: string,
    userId: string | null,
    dto: TrackInteractionDto,
    context: TrackingContext = {},
  ) {
    if (isBotUserAgent(context.userAgent)) return;

    // Verify place exists
    const { data: place } = await this.supabase
      .from(PLACES_TABLE)
      .select('id')
      .eq('id', placeId)
      .eq('is_active', true)
      .maybeSingle();

    if (!place) throw new NotFoundException('Place not found');

    const trackingFields = buildInteractionTrackingFields({
      placeId,
      interactionType: dto.interaction_type,
      promoId: dto.promo_id || null,
      userId,
      anonymousSessionId: dto.anonymous_session_id,
      userAgent: context.userAgent,
    });

    const { error } = await this.supabase.from(TABLE).insert({
      place_id: placeId,
      user_id: userId,
      interaction_type: dto.interaction_type,
      promo_id: dto.promo_id || null,
      ...trackingFields,
    });

    if (error && isDuplicateInteractionError(error)) return;
    if (error) throw new BadRequestException(error.message);

    // TODO: trigger notification dispatch based on business_notification_settings
    // when push/email infrastructure is available (US-025)
  }

  async getSummary(
    placeId: string,
    userId: string,
    userRole: string,
    from: string,
    to: string,
  ) {
    await this.assertOwnership(placeId, userId, userRole);

    const { data, error } = await this.supabase.rpc('place_metrics_summary', {
      p_place_id: placeId,
      p_from: from,
      p_to: to,
    });

    if (error) throw new BadRequestException(error.message);

    const row = (data && data[0]) || {
      total_views: 0,
      total_calls: 0,
      total_whatsapp: 0,
      total_reservations: 0,
      total_directions: 0,
      total_promo_views: 0,
      total_interactions: 0,
      prev_total_interactions: 0,
      change_percent: 0,
    };

    return {
      ...row,
      total_views: Number(row.total_views),
      total_calls: Number(row.total_calls),
      total_whatsapp: Number(row.total_whatsapp),
      total_reservations: Number(row.total_reservations),
      total_directions: Number(row.total_directions),
      total_promo_views: Number(row.total_promo_views),
      total_interactions: Number(row.total_interactions),
      prev_total_interactions: Number(row.prev_total_interactions),
      change_percent: Number(row.change_percent),
      period: { from, to },
    };
  }

  async getTimeseries(
    placeId: string,
    userId: string,
    userRole: string,
    from: string,
    to: string,
    granularity: TimeseriesGranularity = TimeseriesGranularity.DAY,
  ) {
    await this.assertOwnership(placeId, userId, userRole);

    const { data, error } = await this.supabase.rpc(
      'place_metrics_timeseries',
      {
        p_place_id: placeId,
        p_from: from,
        p_to: to,
        p_granularity: granularity,
      },
    );

    if (error) throw new BadRequestException(error.message);

    return (data || []).map((row: any) => ({
      bucket: row.bucket,
      views: Number(row.views),
      calls: Number(row.calls),
      whatsapp: Number(row.whatsapp),
      reservations: Number(row.reservations),
      directions: Number(row.directions),
      promo_views: Number(row.promo_views),
      total: Number(row.total),
    }));
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
        'You can only view metrics of your own places',
      );
    }
  }
}
