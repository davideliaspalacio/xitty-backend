import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { RankingItemDto } from './dto/ranking-response.dto';

const RANKINGS_VIEW = 'place_rankings';
const SNAPSHOTS_TABLE = 'ranking_snapshots';
const PLACES_TABLE = 'places';
const SPONSORED_LABEL = 'Patrocinado';

interface RankingRow {
  place_id: string;
  category_id: string | null;
  position?: number | string | null;
  global_position?: number | string | null;
  category_position?: number | string | null;
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
  average_rating: number | string | null;
  total_reviews: number | string | null;
  is_sponsored: boolean | null;
  sponsored_until: string | null;
  place_photos?: PlacePhotoRow[] | null;
}

interface SnapshotRow {
  place_id: string;
  position: number | string;
  snapshot_at: string;
}

interface SponsorshipPlaceRow {
  id: string;
  is_sponsored: boolean;
  sponsored_at: string | null;
  sponsored_until: string | null;
}

@Injectable()
export class RankingService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async getGlobalRanking(limit = 10) {
    const items = await this.fetchRanking(null, limit);
    return { data: items, category_id: null, limit };
  }

  async getCategoryRanking(categoryId: string, limit = 20) {
    const items = await this.fetchRanking(categoryId, limit);
    return { data: items, category_id: categoryId, limit };
  }

  async refresh() {
    const { error } = await this.supabase.rpc('refresh_place_rankings');
    if (error) throw new BadRequestException(error.message);
    return { refreshed_at: new Date().toISOString() };
  }

  async activateSponsorship(
    placeId: string,
    durationDays: number,
    userRole: string,
  ) {
    if (userRole !== 'admin') {
      throw new ForbiddenException('Only admins can manage sponsorships');
    }

    const sponsoredAt = new Date();
    const sponsoredUntil = new Date(
      sponsoredAt.getTime() + durationDays * 86400_000,
    );

    const { data, error } = await this.supabase
      .from(PLACES_TABLE)
      .update({
        is_sponsored: true,
        sponsored_at: sponsoredAt.toISOString(),
        sponsored_until: sponsoredUntil.toISOString(),
      })
      .eq('id', placeId)
      .select('id, is_sponsored, sponsored_at, sponsored_until')
      .single();

    const place = data as SponsorshipPlaceRow | null;
    if (error || !place) throw new NotFoundException('Place not found');

    return {
      place_id: place.id,
      is_sponsored: place.is_sponsored,
      sponsored_at: place.sponsored_at,
      sponsored_until: place.sponsored_until,
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
      })
      .eq('id', placeId)
      .select('id, is_sponsored, sponsored_at, sponsored_until')
      .single();

    const place = data as SponsorshipPlaceRow | null;
    if (error || !place) throw new NotFoundException('Place not found');

    return {
      place_id: place.id,
      is_sponsored: place.is_sponsored,
      sponsored_at: place.sponsored_at,
      sponsored_until: place.sponsored_until,
    };
  }

  // ── private helpers ────────────────────────────────────────────────────

  private async fetchRanking(
    categoryId: string | null,
    limit: number,
  ): Promise<RankingItemDto[]> {
    // Pull a generous window so sponsored items can be promoted to the top.
    const fetchSize = Math.min(limit * 3, 100);
    const positionColumn = categoryId ? 'category_position' : 'global_position';

    let query = this.supabase
      .from(RANKINGS_VIEW)
      .select(
        'place_id, category_id, position, global_position, category_position, score, views_30d, conversions_30d',
      )
      .order(positionColumn, { ascending: true })
      .limit(fetchSize);

    if (categoryId) query = query.eq('category_id', categoryId);

    const { data: rankings, error } = await query;
    if (error) throw new BadRequestException(error.message);
    const rankingRows = (rankings ?? []) as RankingRow[];
    if (rankingRows.length === 0) return [];

    const placeIds = rankingRows.map((r) => r.place_id);

    // Hydrate place data + cover photo + sponsorship state in parallel with snapshots.
    const [placesResult, snapshotsByPlace] = await Promise.all([
      this.fetchPlaces(placeIds),
      this.fetchPreviousSnapshots(
        placeIds,
        categoryId ? 'category' : 'global',
        categoryId,
      ),
    ]);

    const placesById = new Map<string, RankingPlaceRow>();
    for (const place of placesResult) placesById.set(place.id, place);

    const now = Date.now();

    const items: RankingItemDto[] = rankingRows.map((row) => {
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
        place: {
          id: place?.id ?? row.place_id,
          name: place?.name ?? '',
          slug: place?.slug ?? null,
          description: place?.description ?? null,
          address: place?.address ?? null,
          category_id: place?.category_id ?? row.category_id,
          average_rating: Number(place?.average_rating ?? 0),
          total_reviews: Number(place?.total_reviews ?? 0),
          cover_photo_url: place?.place_photos?.[0]?.url ?? null,
        },
      };
    });

    // Sponsored first (sorted by score), then organic by position.
    items.sort((a, b) => {
      if (a.is_sponsored !== b.is_sponsored) return a.is_sponsored ? -1 : 1;
      if (a.is_sponsored) return b.score - a.score;
      return a.position - b.position;
    });

    return items.slice(0, limit);
  }

  private async fetchPlaces(placeIds: string[]): Promise<RankingPlaceRow[]> {
    const { data, error } = await this.supabase
      .from(PLACES_TABLE)
      .select(
        'id, name, slug, description, address, category_id, average_rating, total_reviews, is_sponsored, sponsored_until, place_photos(url, is_cover, display_order)',
      )
      .in('id', placeIds);

    if (error) throw new BadRequestException(error.message);

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
    scope: 'global' | 'category',
    categoryId: string | null,
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

    const { data, error } = await query;

    if (error) throw new BadRequestException(error.message);

    const byPlace = new Map<string, SnapshotRow>();
    const snapshots = (data ?? []) as SnapshotRow[];
    for (const row of snapshots) {
      if (!byPlace.has(row.place_id)) byPlace.set(row.place_id, row);
    }
    return byPlace;
  }
}
