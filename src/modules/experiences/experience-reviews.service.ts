import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { throwDbError } from '../../common/errors/throw-db-error';

import {
  CreateExperienceReviewDto,
  UpdateExperienceReviewDto,
} from './dto/create-experience-review.dto';
import {
  ExperienceReviewListResponseDto,
  ExperienceReviewResponseDto,
  RatingDistributionResponseDto,
  ReviewPhotoDto,
} from './dto/experience-review-response.dto';

const REVIEWS_TABLE = 'experience_reviews';
const REVIEW_PHOTOS_TABLE = 'experience_review_photos';
const EXPERIENCES_TABLE = 'experiences';

const REVIEW_SELECT = `
  id, experience_id, user_id, rating, comment, reservation_id,
  created_at, updated_at,
  author:profiles!experience_reviews_user_id_fkey(id, full_name)
`;

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

type NumericLike = number | string;

interface ExperienceRow {
  id: string;
  is_active: boolean;
}

interface ExperienceReviewAuthorRow {
  id: string;
  full_name: string | null;
}

interface ExperienceReviewRow {
  id: string;
  experience_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  reservation_id: string | null;
  created_at: string;
  updated_at: string;
  author: ExperienceReviewAuthorRow | null;
}

interface ReviewPhotoRow {
  id: string;
  review_id: string;
  url: string;
  display_order: number;
}

interface RatingDistributionRow {
  rating: NumericLike;
  count: NumericLike;
}

@Injectable()
export class ExperienceReviewsService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findByExperience(
    experienceId: string,
    page = 1,
    limit = 10,
    sort: 'recent' | 'top' = 'recent',
  ): Promise<ExperienceReviewListResponseDto> {
    const offset = (page - 1) * limit;

    let qb = this.supabase
      .from(REVIEWS_TABLE)
      .select(REVIEW_SELECT, { count: 'exact' })
      .eq('experience_id', experienceId);

    qb =
      sort === 'top'
        ? qb
            .order('rating', { ascending: false })
            .order('created_at', { ascending: false })
        : qb.order('created_at', { ascending: false });

    qb = qb.range(offset, offset + limit - 1);

    const { data, error, count } = (await qb) as unknown as SupabaseCountResult<
      ExperienceReviewRow[]
    >;
    if (error) throwDbError(error, 'ExperienceReviewsService');

    const items = data || [];
    const reviewIds = items.map((review) => review.id);

    const photosByReview = new Map<string, ReviewPhotoDto[]>();
    if (reviewIds.length > 0) {
      const { data: photos } = (await this.supabase
        .from(REVIEW_PHOTOS_TABLE)
        .select('id, review_id, url, display_order')
        .in('review_id', reviewIds)
        .order('display_order')) as unknown as SupabaseResult<ReviewPhotoRow[]>;
      for (const photo of photos || []) {
        const arr = photosByReview.get(photo.review_id) ?? [];
        arr.push({
          id: photo.id,
          url: photo.url,
          display_order: photo.display_order,
        });
        photosByReview.set(photo.review_id, arr);
      }
    }

    const hydrated = items.map((review) => ({
      ...review,
      photos: photosByReview.get(review.id) ?? [],
    }));

    return {
      data: hydrated,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getRatingDistribution(
    experienceId: string,
  ): Promise<RatingDistributionResponseDto> {
    const { data, error } = (await this.supabase.rpc(
      'experience_rating_distribution',
      {
        p_experience_id: experienceId,
      },
    )) as unknown as SupabaseResult<RatingDistributionRow[]>;
    if (error) throwDbError(error, 'ExperienceReviewsService');

    const distribution = (data || []).map((row) => ({
      rating: Number(row.rating),
      count: Number(row.count),
    }));

    const total = distribution.reduce((acc, row) => acc + row.count, 0);
    const weighted = distribution.reduce(
      (acc, row) => acc + row.rating * row.count,
      0,
    );
    const average = total === 0 ? 0 : Number((weighted / total).toFixed(1));

    return { distribution, total, average };
  }

  async create(
    experienceId: string,
    userId: string,
    dto: CreateExperienceReviewDto,
  ): Promise<ExperienceReviewResponseDto> {
    // Verify experience exists
    const { data: experience } = (await this.supabase
      .from(EXPERIENCES_TABLE)
      .select('id, is_active')
      .eq('id', experienceId)
      .maybeSingle()) as unknown as SupabaseResult<ExperienceRow>;

    if (!experience) throw new NotFoundException('Experience not found');

    const { data: review, error } = (await this.supabase
      .from(REVIEWS_TABLE)
      .insert({
        experience_id: experienceId,
        user_id: userId,
        rating: dto.rating,
        comment: dto.comment,
        reservation_id: dto.reservation_id,
      })
      .select(REVIEW_SELECT)
      .single()) as unknown as SupabaseResult<ExperienceReviewRow>;

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'You have already reviewed this experience. Use PATCH to update.',
        );
      }
      throwDbError(error, 'ExperienceReviewsService');
    }

    if (!review) throw new BadRequestException('Review could not be created');

    let photos: ReviewPhotoDto[] = [];
    if (dto.photo_urls?.length) {
      const rows = dto.photo_urls.map((url, idx) => ({
        review_id: review.id,
        url,
        display_order: idx,
      }));
      const { data: photoRows, error: photoError } = (await this.supabase
        .from(REVIEW_PHOTOS_TABLE)
        .insert(rows)
        .select('id, url, display_order')) as unknown as SupabaseResult<
        ReviewPhotoDto[]
      >;
      if (photoError) throwDbError(photoError, 'ExperienceReviewsService');
      photos = photoRows || [];
    }

    return { ...review, photos };
  }

  async update(
    experienceId: string,
    userId: string,
    dto: UpdateExperienceReviewDto,
  ): Promise<ExperienceReviewResponseDto> {
    const updates: { rating?: number; comment?: string } = {};
    if (dto.rating !== undefined) updates.rating = dto.rating;
    if (dto.comment !== undefined) updates.comment = dto.comment;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const { data, error } = (await this.supabase
      .from(REVIEWS_TABLE)
      .update(updates)
      .eq('experience_id', experienceId)
      .eq('user_id', userId)
      .select(REVIEW_SELECT)
      .single()) as unknown as SupabaseResult<ExperienceReviewRow>;

    if (error || !data) throw new NotFoundException('Review not found');
    return { ...data, photos: [] };
  }

  async remove(
    experienceId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const qb = this.supabase
      .from(REVIEWS_TABLE)
      .delete()
      .eq('experience_id', experienceId);

    if (userRole !== 'admin') qb.eq('user_id', userId);

    const { error } = await qb;
    if (error) throwDbError(error, 'ExperienceReviewsService');
  }
}
