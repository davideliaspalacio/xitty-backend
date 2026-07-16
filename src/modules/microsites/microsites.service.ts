import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

const PLACES_TABLE = 'places';
const ACTIVE_PROMOS_VIEW = 'active_promotions';
const PHOTOS_TABLE = 'place_photos';

const PLACE_DETAIL_SELECT =
  'id, name, description, address, latitude, longitude, phone, website, price_range, schedule, category_id, categories(id, name, slug, icon), owner_id, tags, average_rating, total_reviews, is_active, slug, cta_phone, cta_whatsapp, reservation_url, created_at, updated_at';

interface SupabaseError {
  message: string;
}

interface SupabaseResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

interface MicrositePlaceRow {
  id: string;
  [key: string]: unknown;
}

@Injectable()
export class MicrositesService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findBySlug(slug: string) {
    const { data: place, error } = (await this.supabase
      .from(PLACES_TABLE)
      .select(PLACE_DETAIL_SELECT)
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()) as unknown as SupabaseResult<MicrositePlaceRow>;

    if (error) throw new BadRequestException(error.message);
    if (!place) throw new NotFoundException('Microsite not found');

    const placeId = place.id;

    // Photos + active promotions in parallel
    const [photosResult, promosResult] = await Promise.all([
      this.supabase
        .from(PHOTOS_TABLE)
        .select('id, url, alt_text, is_cover, display_order')
        .eq('place_id', placeId)
        .order('display_order'),
      this.supabase
        .from(ACTIVE_PROMOS_VIEW)
        .select(
          'id, title, description, discount_percentage, starts_at, ends_at',
        )
        .eq('place_id', placeId)
        .order('created_at', { ascending: false }),
    ]);

    const photos = (photosResult.data ?? []) as Array<{
      url: string;
      is_cover?: boolean;
    }>;

    // Portada derivada igual que en PlacesService (place_photos.is_cover), con
    // fallback a la primera foto. Sin esto el micrositio nunca devolvia
    // `cover_photo_url` y el preview al compartir (og:image / twitter:image)
    // quedaba VACIO — justo el punto de la feature.
    const coverPhotoUrl =
      photos.find((p) => p.is_cover)?.url ?? photos[0]?.url ?? null;

    return {
      ...place,
      cover_photo_url: coverPhotoUrl,
      photos,
      active_promotions: promosResult.data ?? [],
    };
  }
}
