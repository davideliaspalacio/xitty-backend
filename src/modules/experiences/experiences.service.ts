import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { ExperienceListQueryDto } from './dto/experience-list-query.dto';
import { CreateSlotDto } from './dto/create-slot.dto';

const TABLE = 'experiences';
const PHOTOS_TABLE = 'experience_photos';
const SLOTS_TABLE = 'experience_slots';
const AVAILABLE_SLOTS_VIEW = 'available_experience_slots';
const PLACES_TABLE = 'places';

const CARD_SELECT =
  'id, title, slug, description, experience_type, tags, duration_minutes, price_cop, average_rating, total_reviews';
const DETAIL_SELECT =
  'id, operator_place_id, title, slug, description, experience_type, tags, duration_minutes, price_cop, min_participants, max_participants, meeting_point_address, meeting_point_latitude, meeting_point_longitude, cancellation_hours, average_rating, total_reviews, is_active, created_at, updated_at';

@Injectable()
export class ExperiencesService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  // ── Catalog ────────────────────────────────────────────────────────────

  async findAll(query: ExperienceListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    // Filter "available_on" requires joining with slots — easiest path is to
    // pre-resolve the experience_id list via the available_slots view.
    let availableExperienceIds: string[] | null = null;
    if (query.available_on) {
      const dayStart = new Date(query.available_on);
      const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
      const { data: slots, error: slotsError } = await this.supabase
        .from(AVAILABLE_SLOTS_VIEW)
        .select('experience_id')
        .gte('starts_at', dayStart.toISOString())
        .lt('starts_at', dayEnd.toISOString());
      if (slotsError) throw new BadRequestException(slotsError.message);
      availableExperienceIds = Array.from(new Set((slots || []).map((s: any) => s.experience_id)));
      if (availableExperienceIds.length === 0) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
    }

    let qb = this.supabase
      .from(TABLE)
      .select(CARD_SELECT, { count: 'exact' })
      .eq('is_active', true);

    if (query.experience_type) qb = qb.eq('experience_type', query.experience_type);
    if (query.tags?.length) qb = qb.overlaps('tags', query.tags);
    if (query.min_price !== undefined) qb = qb.gte('price_cop', query.min_price);
    if (query.max_price !== undefined) qb = qb.lte('price_cop', query.max_price);
    if (query.min_duration !== undefined) qb = qb.gte('duration_minutes', query.min_duration);
    if (query.max_duration !== undefined) qb = qb.lte('duration_minutes', query.max_duration);
    if (availableExperienceIds) qb = qb.in('id', availableExperienceIds);

    switch (query.sort_by) {
      case 'price_asc':
        qb = qb.order('price_cop', { ascending: true });
        break;
      case 'price_desc':
        qb = qb.order('price_cop', { ascending: false });
        break;
      case 'duration':
        qb = qb.order('duration_minutes', { ascending: true });
        break;
      case 'created_at':
        qb = qb.order('created_at', { ascending: false });
        break;
      default:
        qb = qb.order('average_rating', { ascending: false });
    }

    qb = qb.range(offset, offset + limit - 1);

    const { data, error, count } = await qb;
    if (error) throw new BadRequestException(error.message);

    const items = (data || []).map((e: any) => ({ ...e, cover_photo_url: null as string | null }));

    if (items.length > 0) {
      const ids = items.map((i: any) => i.id);
      const { data: covers } = await this.supabase
        .from(PHOTOS_TABLE)
        .select('experience_id, url')
        .in('experience_id', ids)
        .eq('is_cover', true);

      const coverMap = new Map((covers || []).map((c: any) => [c.experience_id, c.url]));
      items.forEach((i: any) => {
        i.cover_photo_url = coverMap.get(i.id) || null;
      });
    }

    return {
      data: items,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select(DETAIL_SELECT)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) throw new NotFoundException('Experience not found');

    const { data: photos } = await this.supabase
      .from(PHOTOS_TABLE)
      .select('id, url, alt_text, is_cover, display_order')
      .eq('experience_id', id)
      .order('display_order');

    const cover = (photos || []).find((p: any) => p.is_cover) || (photos || [])[0] || null;

    return {
      ...data,
      cover_photo_url: cover?.url ?? null,
      photos: photos || [],
    };
  }

  // ── CRUD ──────────────────────────────────────────────────────────────

  async create(userId: string, userRole: string, dto: CreateExperienceDto) {
    if (userRole !== 'business' && userRole !== 'admin') {
      throw new ForbiddenException('Only business owners or admins can create experiences');
    }

    await this.assertOperatorOwnership(dto.operator_place_id, userId, userRole);

    if (
      dto.min_participants !== undefined
      && dto.max_participants !== undefined
      && dto.max_participants < dto.min_participants
    ) {
      throw new BadRequestException('max_participants must be >= min_participants');
    }

    const { data, error } = await this.supabase
      .from(TABLE)
      .insert({
        operator_place_id: dto.operator_place_id,
        title: dto.title,
        slug: dto.slug,
        description: dto.description,
        experience_type: dto.experience_type,
        tags: dto.tags ?? [],
        duration_minutes: dto.duration_minutes,
        price_cop: dto.price_cop,
        min_participants: dto.min_participants ?? 1,
        max_participants: dto.max_participants ?? 10,
        meeting_point_address: dto.meeting_point_address,
        meeting_point_latitude: dto.meeting_point_latitude,
        meeting_point_longitude: dto.meeting_point_longitude,
        cancellation_hours: dto.cancellation_hours ?? 24,
        is_active: dto.is_active ?? true,
      })
      .select(DETAIL_SELECT)
      .single();

    if (error) throw new BadRequestException(error.message);
    return { ...data, cover_photo_url: null, photos: [] };
  }

  async update(id: string, userId: string, userRole: string, dto: UpdateExperienceDto) {
    const operatorPlaceId = await this.assertExperienceOwnership(id, userId, userRole);
    void operatorPlaceId;

    const updates: Record<string, any> = {};
    const fields = [
      'title', 'slug', 'description', 'experience_type', 'tags',
      'duration_minutes', 'price_cop', 'min_participants', 'max_participants',
      'meeting_point_address', 'meeting_point_latitude', 'meeting_point_longitude',
      'cancellation_hours', 'is_active',
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
      .select(DETAIL_SELECT)
      .single();

    if (error || !data) throw new NotFoundException('Experience not found');
    return data;
  }

  async softDelete(id: string, userRole: string) {
    if (userRole !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    const { error } = await this.supabase
      .from(TABLE)
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
  }

  async addPhoto(
    experienceId: string,
    userId: string,
    userRole: string,
    body: { url: string; alt_text?: string; is_cover?: boolean; display_order?: number },
  ) {
    await this.assertExperienceOwnership(experienceId, userId, userRole);

    const { data, error } = await this.supabase
      .from(PHOTOS_TABLE)
      .insert({
        experience_id: experienceId,
        url: body.url,
        alt_text: body.alt_text,
        is_cover: body.is_cover ?? false,
        display_order: body.display_order ?? 0,
      })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ── Slots ─────────────────────────────────────────────────────────────

  async findSlots(experienceId: string, from?: string, to?: string) {
    let qb = this.supabase
      .from(AVAILABLE_SLOTS_VIEW)
      .select('id, experience_id, starts_at, capacity, seats_taken, seats_available')
      .eq('experience_id', experienceId)
      .order('starts_at', { ascending: true });

    if (from) qb = qb.gte('starts_at', from);
    if (to) qb = qb.lte('starts_at', to);

    const { data, error } = await qb;
    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async createSlot(experienceId: string, userId: string, userRole: string, dto: CreateSlotDto) {
    await this.assertExperienceOwnership(experienceId, userId, userRole);

    if (new Date(dto.starts_at).getTime() <= Date.now()) {
      throw new BadRequestException('starts_at must be in the future');
    }

    const { data, error } = await this.supabase
      .from(SLOTS_TABLE)
      .insert({
        experience_id: experienceId,
        starts_at: dto.starts_at,
        capacity: dto.capacity,
        is_active: dto.is_active ?? true,
      })
      .select('*')
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        throw new BadRequestException('A slot already exists at that date/time for this experience');
      }
      throw new BadRequestException(error.message);
    }
    return { ...data, seats_available: data.capacity - data.seats_taken };
  }

  async deleteSlot(experienceId: string, slotId: string, userId: string, userRole: string) {
    await this.assertExperienceOwnership(experienceId, userId, userRole);

    // If the slot already has confirmed reservations, soft-disable instead of deleting.
    const { data: slot } = await this.supabase
      .from(SLOTS_TABLE)
      .select('id, seats_taken')
      .eq('id', slotId)
      .eq('experience_id', experienceId)
      .maybeSingle();

    if (!slot) throw new NotFoundException('Slot not found');

    if (slot.seats_taken > 0) {
      const { error } = await this.supabase
        .from(SLOTS_TABLE)
        .update({ is_active: false })
        .eq('id', slotId);
      if (error) throw new BadRequestException(error.message);
      return { soft_deleted: true };
    }

    const { error } = await this.supabase.from(SLOTS_TABLE).delete().eq('id', slotId);
    if (error) throw new BadRequestException(error.message);
    return { soft_deleted: false };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private async assertOperatorOwnership(operatorPlaceId: string, userId: string, userRole: string) {
    if (userRole === 'admin') return;

    const { data: place } = await this.supabase
      .from(PLACES_TABLE)
      .select('owner_id')
      .eq('id', operatorPlaceId)
      .maybeSingle();

    if (!place) throw new NotFoundException('Operator place not found');
    if (place.owner_id !== userId) {
      throw new ForbiddenException('You can only create experiences for your own places');
    }
  }

  private async assertExperienceOwnership(experienceId: string, userId: string, userRole: string) {
    const { data: exp } = await this.supabase
      .from(TABLE)
      .select('id, operator_place_id, places:operator_place_id(owner_id)')
      .eq('id', experienceId)
      .maybeSingle();

    if (!exp) throw new NotFoundException('Experience not found');

    if (userRole === 'admin') return exp.operator_place_id;

    const ownerId = (exp as any).places?.owner_id;
    if (ownerId !== userId) {
      throw new ForbiddenException('You can only manage your own experiences');
    }
    return exp.operator_place_id;
  }
}
