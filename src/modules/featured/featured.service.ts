import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { CreateFeaturedDto } from './dto/create-featured.dto';
import { UpdateFeaturedDto } from './dto/update-featured.dto';

const TABLE = 'featured_content';
const CURRENT_VIEW = 'current_featured';
const PLACES_TABLE = 'places';

const PLACE_FIELDS =
  'id, name, slug, description, address, category_id, average_rating, total_reviews, place_photos(url, is_cover, display_order)';
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

@Injectable()
export class FeaturedService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findCurrent() {
    const { data, error } = await this.supabase
      .from(CURRENT_VIEW)
      .select(`*, places:place_id(${PLACE_FIELDS})`)
      .order('position', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    const current = (data || []).map((row: any) => this.toResponse(row));
    if (current.length > 0) return current;
    return this.findFallbackCurrent();
  }

  async findAll(page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase
      .from(TABLE)
      .select(`*, places:place_id(${PLACE_FIELDS})`, { count: 'exact' })
      .order('week_starts_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);

    return {
      data: (data || []).map((row: any) => this.toResponse(row)),
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async create(userId: string, userRole: string, dto: CreateFeaturedDto) {
    this.assertAdmin(userRole);
    this.assertWeekRange(dto.week_starts_at, dto.week_ends_at);

    // Validate that the place exists and is active.
    const { data: place } = await this.supabase
      .from(PLACES_TABLE)
      .select('id, is_active')
      .eq('id', dto.place_id)
      .maybeSingle();

    if (!place) throw new NotFoundException('Place not found');
    if (!place.is_active) {
      throw new BadRequestException('Cannot feature an inactive place');
    }

    const { data, error } = await this.supabase
      .from(TABLE)
      .insert({
        place_id: dto.place_id,
        curator_name: dto.curator_name,
        custom_title: dto.custom_title ?? null,
        custom_description: dto.custom_description ?? null,
        hero_image_url: dto.hero_image_url ?? null,
        week_starts_at: dto.week_starts_at,
        week_ends_at: dto.week_ends_at,
        position: dto.position ?? 0,
        is_active: dto.is_active ?? true,
        created_by: userId,
      })
      .select(`*, places:place_id(${PLACE_FIELDS})`)
      .single();

    if (error) throw new BadRequestException(error.message);
    return this.toResponse(data);
  }

  async update(id: string, userRole: string, dto: UpdateFeaturedDto) {
    this.assertAdmin(userRole);

    if (dto.week_starts_at && dto.week_ends_at) {
      this.assertWeekRange(dto.week_starts_at, dto.week_ends_at);
    }

    const updates: Record<string, any> = {};
    const fields = [
      'curator_name',
      'custom_title',
      'custom_description',
      'hero_image_url',
      'week_starts_at',
      'week_ends_at',
      'position',
      'is_active',
    ] as const;
    for (const k of fields) {
      if ((dto as any)[k] !== undefined) updates[k] = (dto as any)[k];
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const { data, error } = await this.supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .select(`*, places:place_id(${PLACE_FIELDS})`)
      .single();

    if (error || !data) throw new NotFoundException('Featured entry not found');
    return this.toResponse(data);
  }

  async remove(id: string, userRole: string) {
    this.assertAdmin(userRole);

    const { error } = await this.supabase.from(TABLE).delete().eq('id', id);

    if (error) throw new BadRequestException(error.message);
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private assertAdmin(role: string) {
    if (role !== 'admin') {
      throw new ForbiddenException('Only admins can manage featured content');
    }
  }

  private assertWeekRange(starts: string, ends: string) {
    if (new Date(ends) <= new Date(starts)) {
      throw new BadRequestException(
        'week_ends_at must be after week_starts_at',
      );
    }
  }

  private async findFallbackCurrent() {
    const { data, error } = await this.supabase
      .from(PLACES_TABLE)
      .select(PLACE_FIELDS)
      .eq('is_active', true)
      .order('average_rating', { ascending: false })
      .order('total_reviews', { ascending: false })
      .limit(3);

    if (error) throw new BadRequestException(error.message);

    const window = this.currentBogotaWeekWindow();
    return (data || []).map((place: any, index: number) =>
      this.toResponse({
        id: `fallback-${place.id}`,
        place_id: place.id,
        curator_name: 'Xitty',
        custom_title: null,
        custom_description: 'Recomendado por Xitty para esta semana.',
        hero_image_url: null,
        week_starts_at: window.week_starts_at,
        week_ends_at: window.week_ends_at,
        position: index,
        is_active: true,
        created_by: null,
        created_at: window.week_starts_at,
        updated_at: window.week_starts_at,
        places: place,
      }),
    );
  }

  private currentBogotaWeekWindow(now = new Date()) {
    const bogotaNow = new Date(now.getTime() + BOGOTA_OFFSET_MS);
    const weekday = bogotaNow.getUTCDay();
    const daysFromMonday = (weekday + 6) % 7;
    const startLocalAsUtc = Date.UTC(
      bogotaNow.getUTCFullYear(),
      bogotaNow.getUTCMonth(),
      bogotaNow.getUTCDate() - daysFromMonday,
      0,
      0,
      0,
      0,
    );
    const startUtc = new Date(startLocalAsUtc - BOGOTA_OFFSET_MS);
    const endUtc = new Date(startUtc.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    return {
      week_starts_at: startUtc.toISOString(),
      week_ends_at: endUtc.toISOString(),
    };
  }

  private toResponse(row: any) {
    if (!row) return row;
    const place = row.places || null;
    let placeData: any = null;
    if (place) {
      const photos = (place.place_photos || []) as any[];
      const cover = photos.find((p) => p.is_cover) || photos[0] || null;
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
    const { places: _omit, ...rest } = row;
    return { ...rest, place: placeData };
  }
}
