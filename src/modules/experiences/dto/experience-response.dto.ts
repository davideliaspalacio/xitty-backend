import { ApiProperty } from '@nestjs/swagger';

export class ExperiencePhotoDto {
  @ApiProperty() id: string;
  @ApiProperty() url: string;
  @ApiProperty({ nullable: true }) alt_text: string | null;
  @ApiProperty() is_cover: boolean;
  @ApiProperty() display_order: number;
}

export class ExperienceCardDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) slug: string | null;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() experience_type: string;
  @ApiProperty({ type: [String] }) tags: string[];
  @ApiProperty() duration_minutes: number;
  @ApiProperty() price_cop: number;
  @ApiProperty() average_rating: number;
  @ApiProperty() total_reviews: number;
  @ApiProperty({ nullable: true }) cover_photo_url: string | null;
}

export class ExperienceDetailDto extends ExperienceCardDto {
  @ApiProperty() operator_place_id: string;
  @ApiProperty() min_participants: number;
  @ApiProperty() max_participants: number;
  @ApiProperty({ nullable: true }) meeting_point_address: string | null;
  @ApiProperty({ nullable: true }) meeting_point_latitude: number | null;
  @ApiProperty({ nullable: true }) meeting_point_longitude: number | null;
  @ApiProperty() cancellation_hours: number;
  @ApiProperty() is_active: boolean;
  @ApiProperty({ type: [ExperiencePhotoDto] }) photos: ExperiencePhotoDto[];
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
}

export class ExperienceListResponseDto {
  @ApiProperty({ type: [ExperienceCardDto] }) data: ExperienceCardDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class SlotResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() experience_id: string;
  @ApiProperty() starts_at: string;
  @ApiProperty() capacity: number;
  @ApiProperty() seats_taken: number;
  @ApiProperty() seats_available: number;
}
