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
const INTERACTIONS_TABLE = 'microsite_interactions';

const PLACE_DETAIL_SELECT =
  'id, name, description, address, latitude, longitude, phone, website, price_range, schedule, category_id, categories(id, name, slug, icon), owner_id, tags, average_rating, total_reviews, is_active, slug, cta_phone, cta_whatsapp, reservation_url, created_at, updated_at';

@Injectable()
export class MicrositesService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findBySlug(slug: string) {
    const { data: place, error } = await this.supabase
      .from(PLACES_TABLE)
      .select(PLACE_DETAIL_SELECT)
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!place) throw new NotFoundException('Microsite not found');

    const placeId = (place as any).id;

    // Photos + active promotions in parallel
    const [photosResult, promosResult] = await Promise.all([
      this.supabase
        .from(PHOTOS_TABLE)
        .select('id, url, alt_text, is_cover, display_order')
        .eq('place_id', placeId)
        .order('display_order'),
      this.supabase
        .from(ACTIVE_PROMOS_VIEW)
        .select('id, title, description, discount_percentage, starts_at, ends_at')
        .eq('place_id', placeId)
        .order('created_at', { ascending: false }),
    ]);

    // Track profile_view (fire-and-forget; don't block response on errors)
    this.supabase
      .from(INTERACTIONS_TABLE)
      .insert({ place_id: placeId, interaction_type: 'profile_view' })
      .then(undefined, () => undefined);

    return {
      ...place,
      photos: photosResult.data || [],
      active_promotions: promosResult.data || [],
    };
  }
}
