import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';

import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { PlaceListQueryDto, PlaceSortBy } from './dto/place-list-query.dto';
import { CreatePlacePhotoDto } from './dto/create-place-photo.dto';
import { localize, DEFAULT_LANG } from '../../common/i18n/localize';

const PLACES_TABLE = 'places';
const CATEGORIES_TABLE = 'categories';
const PHOTOS_TABLE = 'place_photos';

const PLACE_CARD_SELECT =
  'id, name, description, address, latitude, longitude, price_range, average_rating, total_reviews, tags, translations, categories(id, name, slug, icon)';

const PLACE_DETAIL_SELECT =
  'id, name, description, address, latitude, longitude, phone, website, price_range, schedule, source_reviews, category_id, categories(id, name, slug, icon), owner_id, tags, translations, average_rating, total_reviews, is_active, slug, cta_phone, cta_whatsapp, reservation_url, is_sponsored, sponsored_until, created_at, updated_at';

@Injectable()
export class PlacesService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {}

  async findAllCategories() {
    const { data, error } = await this.supabase
      .from(CATEGORIES_TABLE)
      .select('id, name, slug, icon, description')
      .order('name');

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async findAll(query: PlaceListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    // Distance sort uses RPC
    if (query.sort_by === PlaceSortBy.DISTANCE) {
      if (!query.latitude || !query.longitude) {
        throw new BadRequestException(
          'latitude and longitude are required for distance sorting',
        );
      }
      return this.findAllByDistance(query, page, limit, offset);
    }

    let qb = this.supabase
      .from(PLACES_TABLE)
      .select(PLACE_CARD_SELECT, { count: 'exact' })
      .eq('is_active', true);

    if (query.category_id) qb = qb.eq('category_id', query.category_id);
    if (query.price_range) qb = qb.eq('price_range', query.price_range);
    if (query.traveler_type) {
      qb = qb.contains('tags', [query.traveler_type]);
    }

    if (query.search) {
      qb = qb.ilike('name', `%${query.search}%`);
    }

    switch (query.sort_by) {
      case PlaceSortBy.RATING:
        qb = qb.order('average_rating', { ascending: false });
        break;
      case PlaceSortBy.PRICE:
        qb = qb.order('price_range', { ascending: true });
        break;
      case PlaceSortBy.POPULARITY:
        qb = qb.order('total_reviews', { ascending: false });
        break;
      default:
        qb = qb.order('created_at', { ascending: false });
    }

    qb = qb.range(offset, offset + limit - 1);

    const { data, error, count } = await qb;
    if (error) throw new BadRequestException(error.message);

    const lang = query.lang || DEFAULT_LANG;
    const cards = (data || []).map((p: any) => ({
      ...localize(p, lang),
      cover_photo_url: null, // populated below
    }));

    // Fetch cover photos for the returned places
    if (cards.length > 0) {
      const placeIds = cards.map((c: any) => c.id);
      const { data: covers } = await this.supabase
        .from(PHOTOS_TABLE)
        .select('place_id, url')
        .in('place_id', placeIds)
        .eq('is_cover', true);

      if (covers) {
        const coverMap = new Map(covers.map((c: any) => [c.place_id, c.url]));
        cards.forEach((c: any) => {
          c.cover_photo_url = coverMap.get(c.id) || null;
        });
      }
    }

    return {
      data: cards,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  private async findAllByDistance(
    query: PlaceListQueryDto,
    page: number,
    limit: number,
    offset: number,
  ) {
    const { data, error } = await this.supabase.rpc('list_places_near', {
      user_lat: query.latitude,
      user_lng: query.longitude,
      p_category_id: query.category_id || null,
      p_price_range: query.price_range || null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw new BadRequestException(error.message);

    // Get total count for pagination (separate query without limit)
    let countQb = this.supabase
      .from(PLACES_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (query.category_id) countQb = countQb.eq('category_id', query.category_id);
    if (query.price_range) countQb = countQb.eq('price_range', query.price_range);

    const { count } = await countQb;

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async search(q: string, page = 1, limit = 10, categoryId?: string) {
    const offset = (page - 1) * limit;

    // Use full-text search with Spanish config
    let qb = this.supabase
      .from(PLACES_TABLE)
      .select(PLACE_CARD_SELECT, { count: 'exact' })
      .eq('is_active', true)
      .textSearch('search_vector', q, { type: 'websearch', config: 'spanish' });

    if (categoryId) qb = qb.eq('category_id', categoryId);

    qb = qb.range(offset, offset + limit - 1);

    const { data, error, count } = await qb;
    if (error) throw new BadRequestException(error.message);

    const cards = (data || []).map((p: any) => ({
      ...p,
      cover_photo_url: null,
    }));

    if (cards.length > 0) {
      const placeIds = cards.map((c: any) => c.id);
      const { data: covers } = await this.supabase
        .from(PHOTOS_TABLE)
        .select('place_id, url')
        .in('place_id', placeIds)
        .eq('is_cover', true);

      if (covers) {
        const coverMap = new Map(covers.map((c: any) => [c.place_id, c.url]));
        cards.forEach((c: any) => {
          c.cover_photo_url = coverMap.get(c.id) || null;
        });
      }
    }

    return {
      data: cards,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async findById(id: string, lang?: string) {
    const { data, error } = await this.supabase
      .from(PLACES_TABLE)
      .select(PLACE_DETAIL_SELECT)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) throw new NotFoundException('Place not found');

    // Fetch photos
    const { data: photos } = await this.supabase
      .from(PHOTOS_TABLE)
      .select('id, url, alt_text, is_cover, display_order')
      .eq('place_id', id)
      .order('display_order');

    const localized = localize(data as any, lang || DEFAULT_LANG);
    return { ...localized, photos: photos || [] };
  }

  async create(userId: string, userRole: string, dto: CreatePlaceDto) {
    if (userRole !== 'business' && userRole !== 'admin') {
      throw new ForbiddenException('Only business owners or admins can create places');
    }

    const { data, error } = await this.supabase
      .from(PLACES_TABLE)
      .insert({
        name: dto.name,
        description: dto.description,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        phone: dto.phone,
        website: dto.website,
        price_range: dto.price_range,
        schedule: dto.schedule,
        category_id: dto.category_id,
        owner_id: userId,
        tags: dto.tags || [],
        slug: dto.slug,
        cta_phone: dto.cta_phone,
        cta_whatsapp: dto.cta_whatsapp,
        reservation_url: dto.reservation_url,
      })
      .select(PLACE_DETAIL_SELECT)
      .single();

    if (error) throw new BadRequestException(error.message);
    return { ...data, photos: [] };
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    dto: UpdatePlaceDto,
  ) {
    // Verify ownership
    const { data: existing, error: fetchError } = await this.supabase
      .from(PLACES_TABLE)
      .select('owner_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) throw new NotFoundException('Place not found');

    if (existing.owner_id !== userId && userRole !== 'admin') {
      throw new ForbiddenException('You can only edit your own places');
    }

    // Only admins can change is_active
    if (dto.is_active !== undefined && userRole !== 'admin') {
      throw new ForbiddenException('Only admins can change active status');
    }

    const updates: Record<string, any> = {};
    const fields = [
      'name', 'description', 'address', 'latitude', 'longitude',
      'phone', 'website', 'price_range', 'schedule', 'category_id',
      'tags', 'is_active',
      'slug', 'cta_phone', 'cta_whatsapp', 'reservation_url',
    ] as const;

    for (const key of fields) {
      if ((dto as any)[key] !== undefined) updates[key] = (dto as any)[key];
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const { data, error } = await this.supabase
      .from(PLACES_TABLE)
      .update(updates)
      .eq('id', id)
      .select(PLACE_DETAIL_SELECT)
      .single();

    if (error) throw new BadRequestException(error.message);

    const { data: photos } = await this.supabase
      .from(PHOTOS_TABLE)
      .select('id, url, alt_text, is_cover, display_order')
      .eq('place_id', id)
      .order('display_order');

    return { ...data, photos: photos || [] };
  }

  async softDelete(id: string, userRole: string) {
    if (userRole !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    const { error } = await this.supabase
      .from(PLACES_TABLE)
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);
  }

  async addPhoto(
    placeId: string,
    userId: string,
    userRole: string,
    dto: CreatePlacePhotoDto,
  ) {
    // Verify ownership
    const { data: place } = await this.supabase
      .from(PLACES_TABLE)
      .select('owner_id')
      .eq('id', placeId)
      .single();

    if (!place) throw new NotFoundException('Place not found');

    if (place.owner_id !== userId && userRole !== 'admin') {
      throw new ForbiddenException('You can only add photos to your own places');
    }

    const { data, error } = await this.supabase
      .from(PHOTOS_TABLE)
      .insert({
        place_id: placeId,
        url: dto.url,
        alt_text: dto.alt_text,
        is_cover: dto.is_cover ?? false,
        display_order: dto.display_order ?? 0,
      })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getOgMetadata(id: string) {
    const { data, error } = await this.supabase
      .from(PLACES_TABLE)
      .select('id, name, description, average_rating')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) throw new NotFoundException('Place not found');

    // Get cover photo
    const { data: cover } = await this.supabase
      .from(PHOTOS_TABLE)
      .select('url')
      .eq('place_id', id)
      .eq('is_cover', true)
      .maybeSingle();

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://xitty.co';

    return {
      title: data.name,
      description: data.description
        ? data.description.substring(0, 160)
        : `Descubre ${data.name} en Xitty`,
      image: cover?.url || null,
      url: `${frontendUrl}/places/${data.id}`,
      rating: Number(data.average_rating),
      site_name: 'Xitty',
    };
  }
}
