import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { throwDbError } from '../../common/errors/throw-db-error';

import { CreateLocalPickDto, PickTag } from './dto/create-local-pick.dto';
import {
  LocalPickListResponseDto,
  LocalPickPlaceDto,
  LocalPickResponseDto,
} from './dto/local-pick-response.dto';
import { UpdateLocalPickDto } from './dto/update-local-pick.dto';

const TABLE = 'local_picks';
const CURRENT_VIEW = 'current_local_picks';
const PLACES_TABLE = 'places';

const PLACE_FIELDS =
  'id, name, slug, description, address, category_id, average_rating, total_reviews, place_photos(url, is_cover, display_order)';

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

interface PlaceStatusRow {
  id: string;
  is_active: boolean;
}

interface LocalPickPhotoRow {
  url: string;
  is_cover?: boolean | null;
  display_order?: number | null;
}

interface LocalPickPlaceRow {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  address: string | null;
  category_id: string | null;
  average_rating: NumericLike | null;
  total_reviews: NumericLike | null;
  place_photos?: LocalPickPhotoRow[] | null;
}

interface LocalPickRow {
  id: string;
  place_id: string;
  curator_name: string;
  pick_tag: string;
  short_pitch: string | null;
  hero_image_url: string | null;
  week_starts_at: string;
  week_ends_at: string;
  position: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  places: LocalPickPlaceRow | null;
}

interface LocalPickUpdatePayload {
  curator_name?: string;
  pick_tag?: PickTag;
  short_pitch?: string;
  hero_image_url?: string;
  week_starts_at?: string;
  week_ends_at?: string;
  position?: number;
  is_active?: boolean;
}

@Injectable()
export class LocalPicksService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findCurrent(tag?: string): Promise<LocalPickResponseDto[]> {
    let qb = this.supabase
      .from(CURRENT_VIEW)
      .select(`*, places:place_id(${PLACE_FIELDS})`)
      .order('position', { ascending: true });

    if (tag) qb = qb.eq('pick_tag', tag);

    const { data, error } = (await qb) as unknown as SupabaseResult<
      LocalPickRow[]
    >;
    if (error) throwDbError(error, 'LocalPicksService');
    return (data || []).map((row) => this.toResponse(row));
  }

  async findAll(page = 1, limit = 10): Promise<LocalPickListResponseDto> {
    const offset = (page - 1) * limit;

    const { data, error, count } = (await this.supabase
      .from(TABLE)
      .select(`*, places:place_id(${PLACE_FIELDS})`, { count: 'exact' })
      .order('week_starts_at', { ascending: false })
      .range(offset, offset + limit - 1)) as unknown as SupabaseCountResult<
      LocalPickRow[]
    >;

    if (error) throwDbError(error, 'LocalPicksService');

    return {
      data: (data || []).map((row) => this.toResponse(row)),
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async create(
    userId: string,
    userRole: string,
    dto: CreateLocalPickDto,
  ): Promise<LocalPickResponseDto> {
    this.assertAdmin(userRole);
    this.assertWeekRange(dto.week_starts_at, dto.week_ends_at);

    const { data: place } = (await this.supabase
      .from(PLACES_TABLE)
      .select('id, is_active')
      .eq('id', dto.place_id)
      .maybeSingle()) as unknown as SupabaseResult<PlaceStatusRow>;

    if (!place) throw new NotFoundException('Place not found');
    if (!place.is_active) {
      throw new BadRequestException('Cannot pick an inactive place');
    }

    const { data, error } = (await this.supabase
      .from(TABLE)
      .insert({
        place_id: dto.place_id,
        curator_name: dto.curator_name,
        pick_tag: dto.pick_tag,
        short_pitch: dto.short_pitch ?? null,
        hero_image_url: dto.hero_image_url ?? null,
        week_starts_at: dto.week_starts_at,
        week_ends_at: dto.week_ends_at,
        position: dto.position ?? 0,
        is_active: dto.is_active ?? true,
        created_by: userId,
      })
      .select(`*, places:place_id(${PLACE_FIELDS})`)
      .single()) as unknown as SupabaseResult<LocalPickRow>;

    if (error) throwDbError(error, 'LocalPicksService');
    if (!data) throw new BadRequestException('Local pick could not be created');
    return this.toResponse(data);
  }

  async update(
    id: string,
    userRole: string,
    dto: UpdateLocalPickDto,
  ): Promise<LocalPickResponseDto> {
    this.assertAdmin(userRole);

    if (dto.week_starts_at && dto.week_ends_at) {
      this.assertWeekRange(dto.week_starts_at, dto.week_ends_at);
    }

    const updates: LocalPickUpdatePayload = {};
    if (dto.curator_name !== undefined) updates.curator_name = dto.curator_name;
    if (dto.pick_tag !== undefined) updates.pick_tag = dto.pick_tag;
    if (dto.short_pitch !== undefined) updates.short_pitch = dto.short_pitch;
    if (dto.hero_image_url !== undefined) {
      updates.hero_image_url = dto.hero_image_url;
    }
    if (dto.week_starts_at !== undefined) {
      updates.week_starts_at = dto.week_starts_at;
    }
    if (dto.week_ends_at !== undefined) updates.week_ends_at = dto.week_ends_at;
    if (dto.position !== undefined) updates.position = dto.position;
    if (dto.is_active !== undefined) updates.is_active = dto.is_active;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const { data, error } = (await this.supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .select(`*, places:place_id(${PLACE_FIELDS})`)
      .single()) as unknown as SupabaseResult<LocalPickRow>;

    if (error || !data) throw new NotFoundException('Local pick not found');
    return this.toResponse(data);
  }

  async remove(id: string, userRole: string): Promise<void> {
    this.assertAdmin(userRole);
    const { error } = (await this.supabase
      .from(TABLE)
      .delete()
      .eq('id', id)) as unknown as SupabaseResult<unknown>;
    if (error) throwDbError(error, 'LocalPicksService');
  }

  // ── helpers ───────────────────────────────────────────────────────────

  private assertAdmin(role: string): void {
    if (role !== 'admin') {
      throw new ForbiddenException('Only admins can manage local picks');
    }
  }

  private assertWeekRange(starts: string, ends: string): void {
    if (new Date(ends) <= new Date(starts)) {
      throw new BadRequestException(
        'week_ends_at must be after week_starts_at',
      );
    }
  }

  private toResponse(row: LocalPickRow): LocalPickResponseDto {
    const place = row.places || null;
    let placeData: LocalPickPlaceDto | null = null;
    if (place) {
      const photos = place.place_photos || [];
      const cover = photos.find((photo) => photo.is_cover) || photos[0] || null;
      placeData = {
        id: place.id,
        name: place.name,
        slug: place.slug ?? null,
        description: place.description ?? null,
        address: place.address ?? null,
        category_id: place.category_id ?? null,
        average_rating: Number(place.average_rating ?? 0),
        total_reviews: Number(place.total_reviews ?? 0),
        cover_photo_url: cover?.url ?? null,
      };
    }
    const { places, ...rest } = row;
    void places;
    return { ...rest, place: placeData };
  }
}
