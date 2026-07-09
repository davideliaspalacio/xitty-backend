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
import { CategoryResponseDto } from './dto/category-response.dto';
import {
  PlaceCardDto,
  PlaceDetailDto,
  PlacePhotoDto,
  PlaceListResponseDto,
} from './dto/place-response.dto';
import { OgResponseDto } from './dto/og-response.dto';
import { localize, DEFAULT_LANG } from '../../common/i18n/localize';

const PLACES_TABLE = 'places';
const CATEGORIES_TABLE = 'categories';
const PHOTOS_TABLE = 'place_photos';

const PLACE_CARD_SELECT =
  'id, name, description, address, city, zone, latitude, longitude, price_range, average_rating, total_reviews, tags, translations, categories(id, name, slug, icon)';

const PLACE_DETAIL_SELECT =
  'id, name, description, address, city, zone, latitude, longitude, phone, website, price_range, schedule, source_reviews, category_id, categories(id, name, slug, icon), owner_id, tags, translations, average_rating, total_reviews, is_active, slug, cta_phone, cta_whatsapp, reservation_url, is_sponsored, sponsored_until, created_at, updated_at';

interface SupabaseError {
  message: string;
  code?: string;
}

interface SupabaseSingleResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

interface SupabaseListResult<T> {
  data: T[] | null;
  error: SupabaseError | null;
  count?: number | null;
}

type TranslationEntry = Partial<
  Record<'description' | 'title' | 'name', string>
>;

type PlaceTranslations = Record<string, TranslationEntry>;

type PlaceCardRow = Omit<PlaceCardDto, 'cover_photo_url'> & {
  translations?: PlaceTranslations | null;
};

type PlaceDetailRow = Omit<PlaceDetailDto, 'photos'> & {
  translations?: PlaceTranslations | null;
  source_reviews?: unknown;
};

interface CoverPhotoRow {
  place_id: string;
  url: string;
}

interface PlaceOwnerRow {
  owner_id: string | null;
}

interface PlaceUpdates {
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  zone?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  price_range?: number;
  schedule?: CreatePlaceDto['schedule'];
  category_id?: string;
  tags?: string[];
  is_active?: boolean;
  slug?: string;
  cta_phone?: string;
  cta_whatsapp?: string;
  reservation_url?: string;
}

interface OgPlaceRow {
  id: string;
  name: string;
  description: string | null;
  average_rating: number | string | null;
}

interface OgCoverRow {
  url: string;
}

@Injectable()
export class PlacesService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {}

  async findAllCategories(): Promise<CategoryResponseDto[]> {
    const { data, error } = (await this.supabase
      .from(CATEGORIES_TABLE)
      .select('id, name, slug, icon, description')
      .order('name')) as unknown as SupabaseListResult<CategoryResponseDto>;

    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async findAll(query: PlaceListQueryDto): Promise<PlaceListResponseDto> {
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
    if (query.city) qb = qb.eq('city', normalizeTextFilter(query.city));
    if (query.zone) qb = qb.eq('zone', normalizeTextFilter(query.zone));
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

    const { data, error, count } =
      (await qb) as unknown as SupabaseListResult<PlaceCardRow>;
    if (error) throw new BadRequestException(error.message);

    const lang = query.lang || DEFAULT_LANG;
    const cards: PlaceCardDto[] = (data || []).map((place) => ({
      ...localize(place, lang),
      cover_photo_url: null, // populated below
    }));

    // Fetch cover photos for the returned places
    if (cards.length > 0) {
      const placeIds = cards.map((card) => card.id);
      const { data: covers } = (await this.supabase
        .from(PHOTOS_TABLE)
        .select('place_id, url')
        .in('place_id', placeIds)
        .eq('is_cover', true)) as unknown as SupabaseListResult<CoverPhotoRow>;

      if (covers) {
        const coverMap = new Map(
          covers.map((cover) => [cover.place_id, cover.url]),
        );
        for (const card of cards) {
          card.cover_photo_url = coverMap.get(card.id) || null;
        }
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
  ): Promise<PlaceListResponseDto> {
    const { data, error } = (await this.supabase.rpc('list_places_near', {
      user_lat: query.latitude,
      user_lng: query.longitude,
      p_category_id: query.category_id || null,
      p_price_range: query.price_range || null,
      p_city: query.city ? normalizeTextFilter(query.city) : null,
      p_zone: query.zone ? normalizeTextFilter(query.zone) : null,
      p_limit: limit,
      p_offset: offset,
    })) as unknown as SupabaseListResult<PlaceCardDto>;

    if (error) throw new BadRequestException(error.message);

    // Get total count for pagination (separate query without limit)
    let countQb = this.supabase
      .from(PLACES_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (query.category_id) {
      countQb = countQb.eq('category_id', query.category_id);
    }
    if (query.city) {
      countQb = countQb.eq('city', normalizeTextFilter(query.city));
    }
    if (query.zone) {
      countQb = countQb.eq('zone', normalizeTextFilter(query.zone));
    }
    if (query.price_range) {
      countQb = countQb.eq('price_range', query.price_range);
    }

    const { count } = (await countQb) as unknown as SupabaseListResult<{
      id: string;
    }>;

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async search(
    q: string,
    page = 1,
    limit = 10,
    categoryId?: string,
  ): Promise<PlaceListResponseDto> {
    const offset = (page - 1) * limit;

    // Use full-text search with Spanish config
    let qb = this.supabase
      .from(PLACES_TABLE)
      .select(PLACE_CARD_SELECT, { count: 'exact' })
      .eq('is_active', true)
      .textSearch('search_vector', q, { type: 'websearch', config: 'spanish' });

    if (categoryId) qb = qb.eq('category_id', categoryId);

    qb = qb.range(offset, offset + limit - 1);

    const { data, error, count } =
      (await qb) as unknown as SupabaseListResult<PlaceCardRow>;
    if (error) throw new BadRequestException(error.message);

    const cards: PlaceCardDto[] = (data || []).map((place) => ({
      ...place,
      cover_photo_url: null,
    }));

    if (cards.length > 0) {
      const placeIds = cards.map((card) => card.id);
      const { data: covers } = (await this.supabase
        .from(PHOTOS_TABLE)
        .select('place_id, url')
        .in('place_id', placeIds)
        .eq('is_cover', true)) as unknown as SupabaseListResult<CoverPhotoRow>;

      if (covers) {
        const coverMap = new Map(
          covers.map((cover) => [cover.place_id, cover.url]),
        );
        for (const card of cards) {
          card.cover_photo_url = coverMap.get(card.id) || null;
        }
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

  async findById(id: string, lang?: string): Promise<PlaceDetailDto> {
    const { data, error } = (await this.supabase
      .from(PLACES_TABLE)
      .select(PLACE_DETAIL_SELECT)
      .eq('id', id)
      .eq('is_active', true)
      .single()) as unknown as SupabaseSingleResult<PlaceDetailRow>;

    if (error || !data) throw new NotFoundException('Place not found');

    // Fetch photos
    const { data: photos } = (await this.supabase
      .from(PHOTOS_TABLE)
      .select('id, url, alt_text, is_cover, display_order')
      .eq('place_id', id)
      .order('display_order')) as unknown as SupabaseListResult<PlacePhotoDto>;

    const localized = localize(data, lang || DEFAULT_LANG);
    return { ...localized, photos: photos || [] };
  }

  async create(
    userId: string,
    userRole: string,
    dto: CreatePlaceDto,
  ): Promise<PlaceDetailDto> {
    if (userRole !== 'business' && userRole !== 'admin') {
      throw new ForbiddenException(
        'Only business owners or admins can create places',
      );
    }

    const { data, error } = (await this.supabase
      .from(PLACES_TABLE)
      .insert({
        name: dto.name,
        description: dto.description,
        address: dto.address,
        city: dto.city,
        zone: dto.zone,
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
      .single()) as unknown as SupabaseSingleResult<PlaceDetailRow>;

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new BadRequestException('Could not create place');
    return { ...data, photos: [] };
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    dto: UpdatePlaceDto,
  ): Promise<PlaceDetailDto> {
    // Verify ownership
    const { data: existing, error: fetchError } = (await this.supabase
      .from(PLACES_TABLE)
      .select('owner_id')
      .eq('id', id)
      .single()) as unknown as SupabaseSingleResult<PlaceOwnerRow>;

    if (fetchError || !existing) throw new NotFoundException('Place not found');

    if (existing.owner_id !== userId && userRole !== 'admin') {
      throw new ForbiddenException('You can only edit your own places');
    }

    // Only admins can change is_active
    if (dto.is_active !== undefined && userRole !== 'admin') {
      throw new ForbiddenException('Only admins can change active status');
    }

    const updates: PlaceUpdates = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.address !== undefined) updates.address = dto.address;
    if (dto.city !== undefined) updates.city = dto.city;
    if (dto.zone !== undefined) updates.zone = dto.zone;
    if (dto.latitude !== undefined) updates.latitude = dto.latitude;
    if (dto.longitude !== undefined) updates.longitude = dto.longitude;
    if (dto.phone !== undefined) updates.phone = dto.phone;
    if (dto.website !== undefined) updates.website = dto.website;
    if (dto.price_range !== undefined) updates.price_range = dto.price_range;
    if (dto.schedule !== undefined) updates.schedule = dto.schedule;
    if (dto.category_id !== undefined) updates.category_id = dto.category_id;
    if (dto.tags !== undefined) updates.tags = dto.tags;
    if (dto.is_active !== undefined) updates.is_active = dto.is_active;
    if (dto.slug !== undefined) updates.slug = dto.slug;
    if (dto.cta_phone !== undefined) updates.cta_phone = dto.cta_phone;
    if (dto.cta_whatsapp !== undefined) {
      updates.cta_whatsapp = dto.cta_whatsapp;
    }
    if (dto.reservation_url !== undefined) {
      updates.reservation_url = dto.reservation_url;
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const { data, error } = (await this.supabase
      .from(PLACES_TABLE)
      .update(updates)
      .eq('id', id)
      .select(PLACE_DETAIL_SELECT)
      .single()) as unknown as SupabaseSingleResult<PlaceDetailRow>;

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Place not found');

    const { data: photos } = (await this.supabase
      .from(PHOTOS_TABLE)
      .select('id, url, alt_text, is_cover, display_order')
      .eq('place_id', id)
      .order('display_order')) as unknown as SupabaseListResult<PlacePhotoDto>;

    return { ...data, photos: photos || [] };
  }

  async softDelete(id: string, userRole: string): Promise<void> {
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
  ): Promise<PlacePhotoDto> {
    // Verify ownership
    const { data: place } = (await this.supabase
      .from(PLACES_TABLE)
      .select('owner_id')
      .eq('id', placeId)
      .single()) as unknown as SupabaseSingleResult<PlaceOwnerRow>;

    if (!place) throw new NotFoundException('Place not found');

    if (place.owner_id !== userId && userRole !== 'admin') {
      throw new ForbiddenException(
        'You can only add photos to your own places',
      );
    }

    const { data, error } = (await this.supabase
      .from(PHOTOS_TABLE)
      .insert({
        place_id: placeId,
        url: dto.url,
        alt_text: dto.alt_text,
        is_cover: dto.is_cover ?? false,
        display_order: dto.display_order ?? 0,
      })
      .select('*')
      .single()) as unknown as SupabaseSingleResult<PlacePhotoDto>;

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new BadRequestException('Could not add photo');
    return data;
  }

  async getOgMetadata(id: string): Promise<OgResponseDto> {
    const { data, error } = (await this.supabase
      .from(PLACES_TABLE)
      .select('id, name, description, average_rating')
      .eq('id', id)
      .eq('is_active', true)
      .single()) as unknown as SupabaseSingleResult<OgPlaceRow>;

    if (error || !data) throw new NotFoundException('Place not found');

    // Get cover photo
    const { data: cover } = (await this.supabase
      .from(PHOTOS_TABLE)
      .select('url')
      .eq('place_id', id)
      .eq('is_cover', true)
      .maybeSingle()) as unknown as SupabaseSingleResult<OgCoverRow>;

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://xitty.co';

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

function normalizeTextFilter(value: string): string {
  return value.trim();
}
