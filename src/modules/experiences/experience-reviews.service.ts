import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import {
  CreateExperienceReviewDto,
  UpdateExperienceReviewDto,
} from './dto/create-experience-review.dto';

const REVIEWS_TABLE = 'experience_reviews';
const REVIEW_PHOTOS_TABLE = 'experience_review_photos';
const EXPERIENCES_TABLE = 'experiences';

const REVIEW_SELECT = `
  id, experience_id, user_id, rating, comment, reservation_id,
  created_at, updated_at,
  author:profiles!experience_reviews_user_id_fkey(id, full_name)
`;

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
  ) {
    const offset = (page - 1) * limit;

    let qb = this.supabase
      .from(REVIEWS_TABLE)
      .select(REVIEW_SELECT, { count: 'exact' })
      .eq('experience_id', experienceId);

    qb = sort === 'top'
      ? qb.order('rating', { ascending: false }).order('created_at', { ascending: false })
      : qb.order('created_at', { ascending: false });

    qb = qb.range(offset, offset + limit - 1);

    const { data, error, count } = await qb;
    if (error) throw new BadRequestException(error.message);

    const items = data || [];
    const reviewIds = items.map((r: any) => r.id);

    const photosByReview = new Map<string, any[]>();
    if (reviewIds.length > 0) {
      const { data: photos } = await this.supabase
        .from(REVIEW_PHOTOS_TABLE)
        .select('id, review_id, url, display_order')
        .in('review_id', reviewIds)
        .order('display_order');
      for (const p of photos || []) {
        const arr = photosByReview.get(p.review_id) ?? [];
        arr.push({ id: p.id, url: p.url, display_order: p.display_order });
        photosByReview.set(p.review_id, arr);
      }
    }

    const hydrated = items.map((r: any) => ({
      ...r,
      photos: photosByReview.get(r.id) ?? [],
    }));

    return {
      data: hydrated,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getRatingDistribution(experienceId: string) {
    const { data, error } = await this.supabase.rpc('experience_rating_distribution', {
      p_experience_id: experienceId,
    });
    if (error) throw new BadRequestException(error.message);

    const distribution = (data || []).map((row: any) => ({
      rating: Number(row.rating),
      count: Number(row.count),
    }));

    const total = distribution.reduce((acc: number, r: any) => acc + r.count, 0);
    const weighted = distribution.reduce((acc: number, r: any) => acc + r.rating * r.count, 0);
    const average = total === 0 ? 0 : Number((weighted / total).toFixed(1));

    return { distribution, total, average };
  }

  async create(experienceId: string, userId: string, dto: CreateExperienceReviewDto) {
    // Verify experience exists
    const { data: experience } = await this.supabase
      .from(EXPERIENCES_TABLE)
      .select('id, is_active')
      .eq('id', experienceId)
      .maybeSingle();

    if (!experience) throw new NotFoundException('Experience not found');

    const { data: review, error } = await this.supabase
      .from(REVIEWS_TABLE)
      .insert({
        experience_id: experienceId,
        user_id: userId,
        rating: dto.rating,
        comment: dto.comment,
        reservation_id: dto.reservation_id,
      })
      .select(REVIEW_SELECT)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException('You have already reviewed this experience. Use PATCH to update.');
      }
      throw new BadRequestException(error.message);
    }

    let photos: any[] = [];
    if (dto.photo_urls?.length) {
      const rows = dto.photo_urls.map((url, idx) => ({
        review_id: review.id,
        url,
        display_order: idx,
      }));
      const { data: photoRows, error: photoError } = await this.supabase
        .from(REVIEW_PHOTOS_TABLE)
        .insert(rows)
        .select('id, url, display_order');
      if (photoError) throw new BadRequestException(photoError.message);
      photos = photoRows || [];
    }

    return { ...review, photos };
  }

  async update(
    experienceId: string,
    userId: string,
    dto: UpdateExperienceReviewDto,
  ) {
    const updates: Record<string, any> = {};
    if (dto.rating !== undefined) updates.rating = dto.rating;
    if (dto.comment !== undefined) updates.comment = dto.comment;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const { data, error } = await this.supabase
      .from(REVIEWS_TABLE)
      .update(updates)
      .eq('experience_id', experienceId)
      .eq('user_id', userId)
      .select(REVIEW_SELECT)
      .single();

    if (error || !data) throw new NotFoundException('Review not found');
    return { ...data, photos: [] };
  }

  async remove(experienceId: string, userId: string, userRole: string) {
    const qb = this.supabase
      .from(REVIEWS_TABLE)
      .delete()
      .eq('experience_id', experienceId);

    if (userRole !== 'admin') qb.eq('user_id', userId);

    const { error } = await qb;
    if (error) throw new BadRequestException(error.message);
  }
}
