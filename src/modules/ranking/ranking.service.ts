import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { throwDbError } from '../../common/errors/throw-db-error';

import { RankingItemDto } from './dto/ranking-response.dto';
import { UpdateRankingConfigDto } from './dto/update-ranking-config.dto';

const RANKINGS_VIEW = 'place_rankings';
const SNAPSHOTS_TABLE = 'ranking_snapshots';
const PLACES_TABLE = 'places';
const RANKING_CONFIG_TABLE = 'ranking_config';
const SPONSORED_LABEL = 'Patrocinado';
const SPONSORED_RANKING_SLOTS = 3;
const DEFAULT_RANKING_CONFIG_ID = 'default';
const RANKING_CONFIG_SELECT =
  'id, rating_weight, views_weight, conversions_weight, rating_prior, rating_prior_reviews, views_cap, conversions_cap, window_days, updated_at';

interface RankingRow {
  place_id: string;
  category_id: string | null;
  city?: string | null;
  zone?: string | null;
  position?: number | string | null;
  global_position?: number | string | null;
  category_position?: number | string | null;
  city_position?: number | string | null;
  city_category_position?: number | string | null;
  score: number | string;
  views_30d: number | string;
  conversions_30d: number | string;
}

interface PlacePhotoRow {
  url: string;
  is_cover?: boolean | null;
  display_order?: number | null;
}

interface RankingPlaceRow {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  address: string | null;
  category_id: string | null;
  city: string | null;
  zone: string | null;
  average_rating: number | string | null;
  total_reviews: number | string | null;
  is_sponsored: boolean | null;
  sponsored_until: string | null;
  sponsorship_priority?: number | string | null;
  place_photos?: PlacePhotoRow[] | null;
}

interface SnapshotRow {
  place_id: string;
  position: number | string;
  snapshot_at: string;
}

type RankingScope = 'global' | 'category' | 'city' | 'city_category';

interface SponsorshipPlaceRow {
  id: string;
  is_sponsored: boolean;
  sponsored_at: string | null;
  sponsored_until: string | null;
  sponsorship_priority: number | string | null;
}

export interface RankingConfigDto {
  id: string;
  rating_weight: number;
  views_weight: number;
  conversions_weight: number;
  rating_prior: number;
  rating_prior_reviews: number;
  views_cap: number;
  conversions_cap: number;
  window_days: number;
  updated_at: string;
  weight_total: number;
}

interface RankingConfigRow {
  id: string;
  rating_weight: number | string;
  views_weight: number | string;
  conversions_weight: number | string;
  rating_prior: number | string;
  rating_prior_reviews: number | string;
  views_cap: number | string;
  conversions_cap: number | string;
  window_days: number | string;
  updated_at: string;
}

type RankingItemInternal = RankingItemDto & {
  sponsorship_priority: number;
  sponsored_until: string | null;
};

function toRankingItemDto(item: RankingItemInternal): RankingItemDto {
  return {
    position: item.position,
    previous_position: item.previous_position,
    position_change: item.position_change,
    score: item.score,
    views_30d: item.views_30d,
    conversions_30d: item.conversions_30d,
    is_sponsored: item.is_sponsored,
    sponsored_label: item.sponsored_label,
    place: item.place,
  };
}

@Injectable()
export class RankingService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async getGlobalRanking(limit = 10, city?: string | null) {
    const normalizedCity = normalizeCity(city);
    const items = await this.fetchRanking(null, limit, normalizedCity);
    return { data: items, category_id: null, city: normalizedCity, limit };
  }

  async getCategoryRanking(
    categoryId: string,
    limit = 20,
    city?: string | null,
  ) {
    const normalizedCity = normalizeCity(city);
    const items = await this.fetchRanking(categoryId, limit, normalizedCity);
    return {
      data: items,
      category_id: categoryId,
      city: normalizedCity,
      limit,
    };
  }

  async refresh() {
    const { error } = await this.supabase.rpc('refresh_place_rankings');
    if (error) throwDbError(error, 'RankingService');
    return { refreshed_at: new Date().toISOString() };
  }

  async getConfig(): Promise<RankingConfigDto> {
    return this.fetchConfig();
  }

  async updateConfig(dto: UpdateRankingConfigDto): Promise<RankingConfigDto> {
    const updates = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as UpdateRankingConfigDto;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException(
        'updateConfig requires at least one ranking parameter',
      );
    }

    const current = await this.fetchConfig();
    const nextRatingWeight = updates.rating_weight ?? current.rating_weight;
    const nextViewsWeight = updates.views_weight ?? current.views_weight;
    const nextConversionsWeight =
      updates.conversions_weight ?? current.conversions_weight;

    if (nextRatingWeight + nextViewsWeight + nextConversionsWeight <= 0) {
      throw new BadRequestException(
        'At least one ranking weight must be greater than zero',
      );
    }

    const { data, error } = await this.supabase
      .from(RANKING_CONFIG_TABLE)
      .update(updates)
      .eq('id', DEFAULT_RANKING_CONFIG_ID)
      .select(RANKING_CONFIG_SELECT)
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'Could not update ranking config',
      );
    }

    return normalizeRankingConfig(data as RankingConfigRow);
  }

  async activateSponsorship(
    placeId: string,
    durationDays: number,
    userRole: string,
    priority = 0,
  ) {
    if (userRole !== 'admin') {
      throw new ForbiddenException('Only admins can manage sponsorships');
    }

    const now = new Date();
    const { data: existingData, error: lookupError } = await this.supabase
      .from(PLACES_TABLE)
      .select('id, is_sponsored, sponsored_at, sponsored_until')
      .eq('id', placeId)
      .single();

    const existing = existingData as SponsorshipPlaceRow | null;
    if (lookupError || !existing)
      throw new NotFoundException('Place not found');

    const currentUntil = existing.sponsored_until
      ? new Date(existing.sponsored_until)
      : null;
    const startsFrom =
      existing.is_sponsored &&
      currentUntil &&
      currentUntil.getTime() > now.getTime()
        ? currentUntil
        : now;
    const sponsoredUntil = new Date(
      startsFrom.getTime() + durationDays * 86400_000,
    );

    const { data, error } = await this.supabase
      .from(PLACES_TABLE)
      .update({
        is_sponsored: true,
        sponsored_at: existing.sponsored_at ?? now.toISOString(),
        sponsored_until: sponsoredUntil.toISOString(),
        sponsorship_priority: priority,
      })
      .eq('id', placeId)
      .select(
        'id, is_sponsored, sponsored_at, sponsored_until, sponsorship_priority',
      )
      .single();

    const place = data as SponsorshipPlaceRow | null;
    if (error || !place) throw new NotFoundException('Place not found');

    return {
      place_id: place.id,
      is_sponsored: place.is_sponsored,
      sponsored_at: place.sponsored_at,
      sponsored_until: place.sponsored_until,
      sponsorship_priority: Number(place.sponsorship_priority ?? 0),
    };
  }

  async deactivateSponsorship(placeId: string, userRole: string) {
    if (userRole !== 'admin') {
      throw new ForbiddenException('Only admins can manage sponsorships');
    }

    const { data, error } = await this.supabase
      .from(PLACES_TABLE)
      .update({
        is_sponsored: false,
        sponsored_until: null,
        sponsorship_priority: 0,
      })
      .eq('id', placeId)
      .select(
        'id, is_sponsored, sponsored_at, sponsored_until, sponsorship_priority',
      )
      .single();

    const place = data as SponsorshipPlaceRow | null;
    if (error || !place) throw new NotFoundException('Place not found');

    return {
      place_id: place.id,
      is_sponsored: place.is_sponsored,
      sponsored_at: place.sponsored_at,
      sponsored_until: place.sponsored_until,
      sponsorship_priority: Number(place.sponsorship_priority ?? 0),
    };
  }

  // ── private helpers ────────────────────────────────────────────────────

  private async fetchRanking(
    categoryId: string | null,
    limit: number,
    city: string | null,
  ): Promise<RankingItemDto[]> {
    // Pull a generous window so sponsored items can be promoted to the top.
    const fetchSize = Math.min(limit * 3, 100);
    const positionColumn = getPositionColumn(categoryId, city);
    const scope = getRankingScope(categoryId, city);

    let query = this.supabase
      .from(RANKINGS_VIEW)
      .select(
        'place_id, category_id, city, zone, position, global_position, category_position, city_position, city_category_position, score, views_30d, conversions_30d',
      )
      .order(positionColumn, { ascending: true })
      .limit(fetchSize);

    if (categoryId) query = query.eq('category_id', categoryId);
    if (city) query = query.eq('city', city);

    const { data: rankings, error } = await query;
    if (error) throwDbError(error, 'RankingService');
    const rankingRows = (rankings ?? []) as RankingRow[];
    if (rankingRows.length === 0) return [];

    const placeIds = rankingRows.map((r) => r.place_id);

    // Hydrate place data + cover photo + sponsorship state in parallel with snapshots.
    const [placesResult, snapshotsByPlace] = await Promise.all([
      this.fetchPlaces(placeIds),
      this.fetchPreviousSnapshots(placeIds, scope, categoryId, city),
    ]);

    const placesById = new Map<string, RankingPlaceRow>();
    for (const place of placesResult) placesById.set(place.id, place);

    const now = Date.now();

    const items: RankingItemInternal[] = rankingRows.map((row) => {
      const place = placesById.get(row.place_id);
      const currentPosition = Number(row[positionColumn] ?? row.position);
      const isSponsored =
        !!place?.is_sponsored &&
        !!place?.sponsored_until &&
        new Date(place.sponsored_until).getTime() > now;

      const snapshot = snapshotsByPlace.get(row.place_id);
      const previousPosition = snapshot ? Number(snapshot.position) : null;
      const positionChange =
        previousPosition !== null ? previousPosition - currentPosition : null;

      return {
        position: currentPosition,
        previous_position: previousPosition,
        position_change: positionChange,
        score: Number(row.score),
        views_30d: Number(row.views_30d),
        conversions_30d: Number(row.conversions_30d),
        is_sponsored: isSponsored,
        sponsored_label: isSponsored ? SPONSORED_LABEL : null,
        sponsorship_priority: Number(place?.sponsorship_priority ?? 0),
        sponsored_until: place?.sponsored_until ?? null,
        place: {
          id: place?.id ?? row.place_id,
          name: place?.name ?? '',
          slug: place?.slug ?? null,
          description: place?.description ?? null,
          address: place?.address ?? null,
          category_id: place?.category_id ?? row.category_id,
          city: place?.city ?? row.city ?? null,
          zone: place?.zone ?? row.zone ?? null,
          average_rating: Number(place?.average_rating ?? 0),
          total_reviews: Number(place?.total_reviews ?? 0),
          cover_photo_url: place?.place_photos?.[0]?.url ?? null,
        },
      };
    });

    const sponsoredSlots = items
      .filter((item) => item.is_sponsored)
      .sort((a, b) => {
        if (a.sponsorship_priority !== b.sponsorship_priority) {
          return b.sponsorship_priority - a.sponsorship_priority;
        }
        const aUntil = a.sponsored_until
          ? new Date(a.sponsored_until).getTime()
          : 0;
        const bUntil = b.sponsored_until
          ? new Date(b.sponsored_until).getTime()
          : 0;
        if (aUntil !== bUntil) return bUntil - aUntil;
        return b.score - a.score;
      })
      .slice(0, SPONSORED_RANKING_SLOTS);

    const sponsoredIds = new Set(sponsoredSlots.map((item) => item.place.id));
    const organicItems = items
      .filter((item) => !sponsoredIds.has(item.place.id))
      .map((item) =>
        item.is_sponsored
          ? { ...item, is_sponsored: false, sponsored_label: null }
          : item,
      )
      .sort((a, b) => a.position - b.position);

    return [...sponsoredSlots, ...organicItems]
      .slice(0, limit)
      .map(toRankingItemDto);
  }

  private async fetchPlaces(placeIds: string[]): Promise<RankingPlaceRow[]> {
    const { data, error } = await this.supabase
      .from(PLACES_TABLE)
      .select(
        'id, name, slug, description, address, category_id, city, zone, average_rating, total_reviews, is_sponsored, sponsored_until, sponsorship_priority, place_photos(url, is_cover, display_order)',
      )
      .in('id', placeIds);

    if (error) throwDbError(error, 'RankingService');

    // Keep only the cover photo (or first ordered) per place.
    const places = (data ?? []) as RankingPlaceRow[];
    return places.map((p) => {
      const photos = p.place_photos ?? [];
      const cover = photos.find((ph) => ph.is_cover) || photos[0] || null;
      return { ...p, place_photos: cover ? [cover] : [] };
    });
  }

  private async fetchPreviousSnapshots(
    placeIds: string[],
    scope: RankingScope,
    categoryId: string | null,
    city: string | null,
  ) {
    // Closest snapshot strictly older than 7 days — this is the weekly delta
    // promised in the product copy, without daily refresh noise.
    const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    let query = this.supabase
      .from(SNAPSHOTS_TABLE)
      .select('place_id, position, snapshot_at')
      .in('place_id', placeIds)
      .eq('scope', scope)
      .lt('snapshot_at', cutoff)
      .order('snapshot_at', { ascending: false });

    query = categoryId
      ? query.eq('category_id', categoryId)
      : query.is('category_id', null);

    query = city ? query.eq('city', city) : query.is('city', null);

    const { data, error } = await query;

    if (error) throwDbError(error, 'RankingService');

    const byPlace = new Map<string, SnapshotRow>();
    const snapshots = (data ?? []) as SnapshotRow[];
    for (const row of snapshots) {
      if (!byPlace.has(row.place_id)) byPlace.set(row.place_id, row);
    }
    return byPlace;
  }

  private async fetchConfig(): Promise<RankingConfigDto> {
    const { data, error } = await this.supabase
      .from(RANKING_CONFIG_TABLE)
      .select(RANKING_CONFIG_SELECT)
      .eq('id', DEFAULT_RANKING_CONFIG_ID)
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'Could not read ranking config',
      );
    }

    return normalizeRankingConfig(data as RankingConfigRow);
  }
}

function normalizeCity(city?: string | null): string | null {
  if (!city) return null;
  const trimmed = city.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getRankingScope(
  categoryId: string | null,
  city: string | null,
): RankingScope {
  if (city && categoryId) return 'city_category';
  if (city) return 'city';
  if (categoryId) return 'category';
  return 'global';
}

function getPositionColumn(categoryId: string | null, city: string | null) {
  if (city && categoryId) return 'city_category_position';
  if (city) return 'city_position';
  if (categoryId) return 'category_position';
  return 'global_position';
}

function normalizeRankingConfig(row: RankingConfigRow): RankingConfigDto {
  const ratingWeight = Number(row.rating_weight);
  const viewsWeight = Number(row.views_weight);
  const conversionsWeight = Number(row.conversions_weight);

  return {
    id: row.id,
    rating_weight: ratingWeight,
    views_weight: viewsWeight,
    conversions_weight: conversionsWeight,
    rating_prior: Number(row.rating_prior),
    rating_prior_reviews: Number(row.rating_prior_reviews),
    views_cap: Number(row.views_cap),
    conversions_cap: Number(row.conversions_cap),
    window_days: Number(row.window_days),
    updated_at: row.updated_at,
    weight_total: ratingWeight + viewsWeight + conversionsWeight,
  };
}
