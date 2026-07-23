import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { throwDbError } from '../../common/errors/throw-db-error';
import {
  InteractionType,
  TrackInteractionDto,
} from './dto/track-interaction.dto';
import { TimeseriesGranularity } from './dto/metrics-timeseries.dto';
import {
  buildInteractionTrackingFields,
  isBotUserAgent,
  isDuplicateInteractionError,
  TrackingContext,
} from './interaction-tracking.util';

const TABLE = 'microsite_interactions';
const PLACES_TABLE = 'places';
const NOTIFICATION_SETTINGS_TABLE = 'business_notification_settings';
const NOTIFICATION_OUTBOX_TABLE = 'business_notification_outbox';

const NOTIFIABLE_INTERACTIONS = {
  [InteractionType.CALL_CLICK]: 'notify_call_click',
  [InteractionType.WHATSAPP_CLICK]: 'notify_whatsapp_click',
  [InteractionType.RESERVATION_CLICK]: 'notify_reservation_click',
} as const;

type NotifiableInteractionType = keyof typeof NOTIFIABLE_INTERACTIONS;
type NotificationPreferenceField =
  (typeof NOTIFIABLE_INTERACTIONS)[NotifiableInteractionType];

interface TrackingPlaceRow {
  id: string;
  owner_id: string | null;
}

interface InsertedInteractionRow {
  id: string;
}

type NotificationSettingsRow = Partial<
  Record<NotificationPreferenceField, boolean>
>;

type NumericLike = number | string;

interface MetricsSummaryRow {
  total_views: NumericLike;
  total_calls: NumericLike;
  total_whatsapp: NumericLike;
  total_reservations: NumericLike;
  total_directions: NumericLike;
  total_promo_views: NumericLike;
  total_interactions: NumericLike;
  prev_total_views: NumericLike;
  prev_total_calls: NumericLike;
  prev_total_whatsapp: NumericLike;
  prev_total_reservations: NumericLike;
  prev_total_directions: NumericLike;
  prev_total_promo_views: NumericLike;
  prev_total_interactions: NumericLike;
  views_change_percent: NumericLike;
  calls_change_percent: NumericLike;
  whatsapp_change_percent: NumericLike;
  reservations_change_percent: NumericLike;
  directions_change_percent: NumericLike;
  promo_views_change_percent: NumericLike;
  change_percent: NumericLike;
}

interface MetricsTimeseriesRow {
  bucket: string;
  views: NumericLike;
  calls: NumericLike;
  whatsapp: NumericLike;
  reservations: NumericLike;
  directions: NumericLike;
  promo_views: NumericLike;
  total: NumericLike;
}

interface PlaceOwnerRow {
  owner_id: string | null;
}

interface QueueInteractionNotificationInput {
  ownerId: string | null;
  placeId: string;
  interactionId: string | null;
  interactionType: InteractionType;
}

const EMPTY_SUMMARY_ROW: MetricsSummaryRow = {
  total_views: 0,
  total_calls: 0,
  total_whatsapp: 0,
  total_reservations: 0,
  total_directions: 0,
  total_promo_views: 0,
  total_interactions: 0,
  prev_total_views: 0,
  prev_total_calls: 0,
  prev_total_whatsapp: 0,
  prev_total_reservations: 0,
  prev_total_directions: 0,
  prev_total_promo_views: 0,
  prev_total_interactions: 0,
  views_change_percent: 0,
  calls_change_percent: 0,
  whatsapp_change_percent: 0,
  reservations_change_percent: 0,
  directions_change_percent: 0,
  promo_views_change_percent: 0,
  change_percent: 0,
};

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
    const placeResult = await this.supabase
      .from(PLACES_TABLE)
      .select('id, owner_id')
      .eq('id', placeId)
      .eq('is_active', true)
      .maybeSingle();
    const place = placeResult.data as TrackingPlaceRow | null;

    if (!place) throw new NotFoundException('Place not found');

    const trackingFields = buildInteractionTrackingFields({
      placeId,
      interactionType: dto.interaction_type,
      promoId: dto.promo_id || null,
      userId,
      anonymousSessionId: dto.anonymous_session_id,
      userAgent: context.userAgent,
    });

    const interactionResult = await this.supabase
      .from(TABLE)
      .insert({
        place_id: placeId,
        user_id: userId,
        interaction_type: dto.interaction_type,
        promo_id: dto.promo_id || null,
        ...trackingFields,
      })
      .select('id')
      .single();
    const interaction = interactionResult.data as InsertedInteractionRow | null;
    const interactionError = interactionResult.error;

    if (interactionError && isDuplicateInteractionError(interactionError)) {
      return;
    }
    if (interactionError) {
      throwDbError(interactionError, 'MetricsService');
    }

    await this.queueInteractionNotification({
      ownerId: place.owner_id || null,
      placeId,
      interactionId: interaction?.id || null,
      interactionType: dto.interaction_type,
    });
  }

  async getSummary(
    placeId: string,
    userId: string,
    userRole: string,
    from: string,
    to: string,
  ) {
    await this.assertOwnership(placeId, userId, userRole);

    const summaryResult = await this.supabase.rpc('place_metrics_summary', {
      p_place_id: placeId,
      p_from: from,
      p_to: to,
    });

    if (summaryResult.error) {
      throwDbError(summaryResult.error, 'MetricsService');
    }

    const summaryRows = (summaryResult.data || []) as MetricsSummaryRow[];
    const row = summaryRows[0] || EMPTY_SUMMARY_ROW;

    return {
      ...row,
      total_views: Number(row.total_views),
      total_calls: Number(row.total_calls),
      total_whatsapp: Number(row.total_whatsapp),
      total_reservations: Number(row.total_reservations),
      total_directions: Number(row.total_directions),
      total_promo_views: Number(row.total_promo_views),
      total_interactions: Number(row.total_interactions),
      prev_total_views: Number(row.prev_total_views),
      prev_total_calls: Number(row.prev_total_calls),
      prev_total_whatsapp: Number(row.prev_total_whatsapp),
      prev_total_reservations: Number(row.prev_total_reservations),
      prev_total_directions: Number(row.prev_total_directions),
      prev_total_promo_views: Number(row.prev_total_promo_views),
      prev_total_interactions: Number(row.prev_total_interactions),
      views_change_percent: Number(row.views_change_percent),
      calls_change_percent: Number(row.calls_change_percent),
      whatsapp_change_percent: Number(row.whatsapp_change_percent),
      reservations_change_percent: Number(row.reservations_change_percent),
      directions_change_percent: Number(row.directions_change_percent),
      promo_views_change_percent: Number(row.promo_views_change_percent),
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

    const timeseriesResult = await this.supabase.rpc(
      'place_metrics_timeseries',
      {
        p_place_id: placeId,
        p_from: from,
        p_to: to,
        p_granularity: granularity,
      },
    );

    if (timeseriesResult.error) {
      throwDbError(timeseriesResult.error, 'MetricsService');
    }

    const rows = (timeseriesResult.data || []) as MetricsTimeseriesRow[];
    return rows.map((row) => ({
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

    const placeResult = await this.supabase
      .from(PLACES_TABLE)
      .select('owner_id')
      .eq('id', placeId)
      .maybeSingle();
    const place = placeResult.data as PlaceOwnerRow | null;

    if (!place) throw new NotFoundException('Place not found');
    if (place.owner_id !== userId) {
      throw new ForbiddenException(
        'You can only view metrics of your own places',
      );
    }
  }

  private async queueInteractionNotification({
    ownerId,
    placeId,
    interactionId,
    interactionType,
  }: QueueInteractionNotificationInput) {
    const preferenceField =
      NOTIFIABLE_INTERACTIONS[interactionType as NotifiableInteractionType];

    if (!ownerId || !interactionId || !preferenceField) return;

    try {
      const settingsResult = await this.supabase
        .from(NOTIFICATION_SETTINGS_TABLE)
        .select(preferenceField)
        .eq('user_id', ownerId)
        .maybeSingle();
      const settings = settingsResult.data as NotificationSettingsRow | null;

      if (settingsResult.error || settings?.[preferenceField] === false) return;

      await this.supabase.from(NOTIFICATION_OUTBOX_TABLE).insert({
        recipient_user_id: ownerId,
        place_id: placeId,
        interaction_id: interactionId,
        notification_type: interactionType,
        channel: 'pending',
        status: 'pending',
        dedup_key: `${interactionType}:${interactionId}`,
        payload: {
          interaction_type: interactionType,
          place_id: placeId,
        },
      });
    } catch {
      return;
    }
  }
}
