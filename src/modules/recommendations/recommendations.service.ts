import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { TodayQueryDto } from './dto/today-query.dto';
import {
  RecommendationItemDto,
  TodayRecommendationsResponseDto,
} from './dto/recommendation-item.dto';

const PLACES_TABLE = 'places';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const FALLBACK_REASON = 'Recomendado para ti';

const PLACE_SUMMARY_SELECT =
  'id, name, slug, description, address, latitude, longitude, price_range, average_rating, total_reviews, tags, category_id, categories(id, name, slug, icon), place_photos(url, is_cover, display_order)';

interface RpcRecommendationRow {
  place_id: string;
  score: number | string;
  reason: string | null;
}

@Injectable()
export class RecommendationsService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * "Vale la pena hoy" — combina preferencias + ubicación + hora actual +
   * ranking base y devuelve top N lugares con una razón legible en español.
   */
  async today(
    userId: string,
    query: TodayQueryDto,
  ): Promise<TodayRecommendationsResponseDto> {
    const limit = this.clampLimit(query.limit);
    const lat = query.lat ?? null;
    const lng = query.lng ?? null;

    const { data: rpcData, error: rpcError } = await this.supabase.rpc(
      'compute_recommendations_for',
      {
        p_user_id: userId,
        p_user_lat: lat,
        p_user_lng: lng,
        p_limit: limit,
      },
    );

    if (rpcError) {
      throw new BadRequestException(rpcError.message);
    }

    const rows = (rpcData || []) as RpcRecommendationRow[];

    if (rows.length === 0) {
      return {
        items: [],
        generated_at: new Date().toISOString(),
      };
    }

    const placeIds = rows.map((r) => r.place_id);
    const placesById = await this.hydratePlaces(placeIds);

    // Mantener el orden del RPC (que ya viene ordenado por score DESC).
    const items: RecommendationItemDto[] = rows.map((row) => {
      const place = placesById.get(row.place_id);
      const photos = (place?.place_photos || []) as any[];
      const cover =
        photos.find((p) => p.is_cover) || photos[0] || null;

      const category = place?.categories
        ? {
            id: place.categories.id ?? null,
            name: place.categories.name ?? null,
            slug: place.categories.slug ?? null,
            icon: place.categories.icon ?? null,
          }
        : null;

      const reason =
        row.reason && row.reason.trim().length > 0
          ? row.reason
          : FALLBACK_REASON;

      return {
        place: {
          id: place?.id ?? row.place_id,
          name: place?.name ?? '',
          slug: place?.slug ?? null,
          description: place?.description ?? null,
          address: place?.address ?? null,
          latitude: place?.latitude ?? null,
          longitude: place?.longitude ?? null,
          price_range: place?.price_range ?? null,
          average_rating: Number(place?.average_rating ?? 0),
          total_reviews: Number(place?.total_reviews ?? 0),
          tags: (place?.tags as string[]) ?? [],
          category_id: place?.category_id ?? null,
          category,
          cover_photo_url: cover?.url ?? null,
        },
        score: Number(row.score),
        reason,
      };
    });

    return {
      items,
      generated_at: new Date().toISOString(),
    };
  }

  // ── private helpers ────────────────────────────────────────────────────

  private clampLimit(input?: number): number {
    if (input === undefined || input === null || Number.isNaN(input)) {
      return DEFAULT_LIMIT;
    }
    if (input < 1) return 1;
    if (input > MAX_LIMIT) return MAX_LIMIT;
    return Math.floor(input);
  }

  private async hydratePlaces(
    placeIds: string[],
  ): Promise<Map<string, any>> {
    const { data, error } = await this.supabase
      .from(PLACES_TABLE)
      .select(PLACE_SUMMARY_SELECT)
      .in('id', placeIds);

    if (error) throw new BadRequestException(error.message);

    const map = new Map<string, any>();
    for (const place of data || []) {
      map.set((place as any).id, place);
    }
    return map;
  }
}
