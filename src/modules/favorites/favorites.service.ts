import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'favorites';

@Injectable()
export class FavoritesService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async toggle(placeId: string, userId: string) {
    // Verify place exists
    const { data: place } = await this.supabase
      .from('places')
      .select('id')
      .eq('id', placeId)
      .eq('is_active', true)
      .maybeSingle();

    if (!place) throw new NotFoundException('Place not found');

    // Check if already favorited
    const { data: existing } = await this.supabase
      .from(TABLE)
      .select('user_id')
      .eq('user_id', userId)
      .eq('place_id', placeId)
      .maybeSingle();

    if (existing) {
      // Remove favorite
      const { error } = await this.supabase
        .from(TABLE)
        .delete()
        .eq('user_id', userId)
        .eq('place_id', placeId);

      if (error) throw new BadRequestException(error.message);
      return { place_id: placeId, is_favorite: false };
    }

    // Add favorite
    const { error } = await this.supabase
      .from(TABLE)
      .insert({ user_id: userId, place_id: placeId });

    if (error) throw new BadRequestException(error.message);
    return { place_id: placeId, is_favorite: true };
  }

  async findByUserId(userId: string, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase
      .from(TABLE)
      .select(
        'place_id, created_at, places(id, name, average_rating, total_reviews, price_range, categories(id, name, slug, icon))',
        { count: 'exact' },
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);

    // Fetch cover photos for favorited places
    const items = data || [];
    const placeIds = items
      .map((f: any) => f.places?.id)
      .filter(Boolean);

    let coverMap = new Map<string, string>();
    if (placeIds.length > 0) {
      const { data: covers } = await this.supabase
        .from('place_photos')
        .select('place_id, url')
        .in('place_id', placeIds)
        .eq('is_cover', true);

      if (covers) {
        coverMap = new Map(covers.map((c: any) => [c.place_id, c.url]));
      }
    }

    const result = items.map((f: any) => ({
      place: {
        ...f.places,
        cover_photo_url: coverMap.get(f.places?.id) || null,
      },
      favorited_at: f.created_at,
    }));

    return {
      data: result,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }
}
