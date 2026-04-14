import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

const TABLE = 'reviews';

const REVIEW_SELECT = 'id, place_id, user_id, profiles(full_name), rating, comment, created_at, updated_at';

@Injectable()
export class ReviewsService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findByPlaceId(placeId: string, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase
      .from(TABLE)
      .select(REVIEW_SELECT, { count: 'exact' })
      .eq('place_id', placeId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async create(placeId: string, userId: string, dto: CreateReviewDto) {
    // Verify place exists
    const { data: place } = await this.supabase
      .from('places')
      .select('id')
      .eq('id', placeId)
      .eq('is_active', true)
      .maybeSingle();

    if (!place) throw new NotFoundException('Place not found');

    const { data, error } = await this.supabase
      .from(TABLE)
      .insert({
        place_id: placeId,
        user_id: userId,
        rating: dto.rating,
        comment: dto.comment,
      })
      .select(REVIEW_SELECT)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException('You have already reviewed this place. Use PATCH to update.');
      }
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async update(placeId: string, userId: string, dto: UpdateReviewDto) {
    const updates: Record<string, any> = {};
    if (dto.rating !== undefined) updates.rating = dto.rating;
    if (dto.comment !== undefined) updates.comment = dto.comment;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const { data, error } = await this.supabase
      .from(TABLE)
      .update(updates)
      .eq('place_id', placeId)
      .eq('user_id', userId)
      .select(REVIEW_SELECT)
      .single();

    if (error || !data) {
      throw new NotFoundException('Review not found');
    }

    return data;
  }

  async remove(placeId: string, userId: string) {
    const { error } = await this.supabase
      .from(TABLE)
      .delete()
      .eq('place_id', placeId)
      .eq('user_id', userId);

    if (error) throw new BadRequestException(error.message);
  }
}
