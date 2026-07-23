import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { throwDbError } from '../../common/errors/throw-db-error';

import {
  FavoriteItemDto,
  FavoriteListResponseDto,
  FavoritePlaceDto,
  FavoriteToggleResponseDto,
} from './dto/favorite-response.dto';

const TABLE = 'favorites';

interface SupabaseError {
  message: string;
}

interface SupabaseResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

interface SupabaseCountResult<T> extends SupabaseResult<T> {
  count: number | null;
}

type NumericLike = number | string;

interface PlaceExistsRow {
  id: string;
}

interface FavoriteExistingRow {
  user_id: string;
}

interface FavoriteCategoryRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

interface FavoritePlaceRow {
  id: string;
  name: string;
  average_rating: NumericLike;
  total_reviews: NumericLike;
  price_range: number | null;
  categories: FavoriteCategoryRow | null;
}

interface FavoriteRow {
  place_id: string;
  created_at: string;
  places: FavoritePlaceRow | null;
}

interface PlaceCoverRow {
  place_id: string;
  url: string;
}

@Injectable()
export class FavoritesService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async toggle(
    placeId: string,
    userId: string,
  ): Promise<FavoriteToggleResponseDto> {
    // Verify place exists
    const { data: place } = (await this.supabase
      .from('places')
      .select('id')
      .eq('id', placeId)
      .eq('is_active', true)
      .maybeSingle()) as unknown as SupabaseResult<PlaceExistsRow>;

    if (!place) throw new NotFoundException('Place not found');

    // Check if already favorited
    const { data: existing } = (await this.supabase
      .from(TABLE)
      .select('user_id')
      .eq('user_id', userId)
      .eq('place_id', placeId)
      .maybeSingle()) as unknown as SupabaseResult<FavoriteExistingRow>;

    if (existing) {
      // Remove favorite
      const { error } = (await this.supabase
        .from(TABLE)
        .delete()
        .eq('user_id', userId)
        .eq('place_id', placeId)) as unknown as SupabaseResult<unknown>;

      if (error) throwDbError(error, 'FavoritesService');
      return { place_id: placeId, is_favorite: false };
    }

    // Add favorite
    const { error } = (await this.supabase.from(TABLE).insert({
      user_id: userId,
      place_id: placeId,
    })) as unknown as SupabaseResult<unknown>;

    if (error) throwDbError(error, 'FavoritesService');
    return { place_id: placeId, is_favorite: true };
  }

  async findByUserId(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<FavoriteListResponseDto> {
    const offset = (page - 1) * limit;

    const { data, error, count } = (await this.supabase
      .from(TABLE)
      .select(
        'place_id, created_at, places(id, name, average_rating, total_reviews, price_range, categories(id, name, slug, icon))',
        { count: 'exact' },
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)) as unknown as SupabaseCountResult<
      FavoriteRow[]
    >;

    if (error) throwDbError(error, 'FavoritesService');

    // Fetch cover photos for favorited places
    const items = data || [];
    const placeIds = items
      .map((favorite) => favorite.places?.id)
      .filter((id): id is string => Boolean(id));

    let coverMap = new Map<string, string>();
    if (placeIds.length > 0) {
      const { data: covers } = (await this.supabase
        .from('place_photos')
        .select('place_id, url')
        .in('place_id', placeIds)
        .eq('is_cover', true)) as unknown as SupabaseResult<PlaceCoverRow[]>;

      if (covers) {
        coverMap = new Map(
          covers.map((cover): [string, string] => [cover.place_id, cover.url]),
        );
      }
    }

    const result: FavoriteItemDto[] = items.map((favorite) => {
      const place = favorite.places;
      const placePayload = place
        ? {
            ...place,
            average_rating: Number(place.average_rating),
            total_reviews: Number(place.total_reviews),
            cover_photo_url: coverMap.get(place.id) || null,
          }
        : ({ cover_photo_url: null } as FavoritePlaceDto);

      return {
        place: placePayload,
        favorited_at: favorite.created_at,
      };
    });

    return {
      data: result,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }
}
