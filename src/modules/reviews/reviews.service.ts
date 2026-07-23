import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { throwDbError } from '../../common/errors/throw-db-error';

import { CreateReviewDto } from './dto/create-review.dto';
import {
  ReviewListResponseDto,
  ReviewResponseDto,
} from './dto/review-response.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

const TABLE = 'reviews';

const REVIEW_SELECT =
  'id, place_id, user_id, profiles(full_name), rating, comment, created_at, updated_at';

interface SupabaseError {
  message: string;
  code?: string;
}

interface SupabaseResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

interface SupabaseCountResult<T> extends SupabaseResult<T> {
  count: number | null;
}

interface PlaceExistsRow {
  id: string;
}

interface ReviewRow {
  id: string;
  place_id: string;
  user_id: string;
  profiles: { full_name: string | null } | null;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ReviewsService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findByPlaceId(
    placeId: string,
    page = 1,
    limit = 10,
  ): Promise<ReviewListResponseDto> {
    const offset = (page - 1) * limit;

    const { data, error, count } = (await this.supabase
      .from(TABLE)
      .select(REVIEW_SELECT, { count: 'exact' })
      .eq('place_id', placeId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)) as unknown as SupabaseCountResult<
      ReviewRow[]
    >;

    if (error) throwDbError(error, 'ReviewsService');

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async create(
    placeId: string,
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    // Verify place exists
    const { data: place } = (await this.supabase
      .from('places')
      .select('id')
      .eq('id', placeId)
      .eq('is_active', true)
      .maybeSingle()) as unknown as SupabaseResult<PlaceExistsRow>;

    if (!place) throw new NotFoundException('Place not found');

    const { data, error } = (await this.supabase
      .from(TABLE)
      .insert({
        place_id: placeId,
        user_id: userId,
        rating: dto.rating,
        comment: dto.comment,
      })
      .select(REVIEW_SELECT)
      .single()) as unknown as SupabaseResult<ReviewRow>;

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'You have already reviewed this place. Use PATCH to update.',
        );
      }
      throwDbError(error, 'ReviewsService');
    }

    if (!data) throw new BadRequestException('Review could not be created');

    return data;
  }

  async update(
    placeId: string,
    userId: string,
    dto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    const updates: { rating?: number; comment?: string } = {};
    if (dto.rating !== undefined) updates.rating = dto.rating;
    if (dto.comment !== undefined) updates.comment = dto.comment;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const { data, error } = (await this.supabase
      .from(TABLE)
      .update(updates)
      .eq('place_id', placeId)
      .eq('user_id', userId)
      .select(REVIEW_SELECT)
      .single()) as unknown as SupabaseResult<ReviewRow>;

    if (error || !data) {
      throw new NotFoundException('Review not found');
    }

    return data;
  }

  async remove(placeId: string, userId: string): Promise<void> {
    const { error } = (await this.supabase
      .from(TABLE)
      .delete()
      .eq('place_id', placeId)
      .eq('user_id', userId)) as unknown as SupabaseResult<unknown>;

    if (error) throwDbError(error, 'ReviewsService');
  }
}
