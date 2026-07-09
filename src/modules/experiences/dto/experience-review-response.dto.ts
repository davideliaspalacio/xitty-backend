import { ApiProperty } from '@nestjs/swagger';

export class ReviewPhotoDto {
  @ApiProperty() id: string;
  @ApiProperty() url: string;
  @ApiProperty() display_order: number;
}

export class ExperienceReviewAuthorDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) full_name: string | null;
}

export class ExperienceReviewResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() experience_id: string;
  @ApiProperty() user_id: string;
  @ApiProperty() rating: number;
  @ApiProperty({ nullable: true }) comment: string | null;
  @ApiProperty({ nullable: true }) reservation_id: string | null;
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
  @ApiProperty({ type: [ReviewPhotoDto] }) photos: ReviewPhotoDto[];
  @ApiProperty({ nullable: true, type: ExperienceReviewAuthorDto })
  author: ExperienceReviewAuthorDto | null;
}

export class ExperienceReviewListResponseDto {
  @ApiProperty({ type: [ExperienceReviewResponseDto] })
  data: ExperienceReviewResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class RatingDistributionItemDto {
  @ApiProperty() rating: number;
  @ApiProperty() count: number;
}

export class RatingDistributionResponseDto {
  @ApiProperty({ type: [RatingDistributionItemDto] })
  distribution: RatingDistributionItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() average: number;
}
