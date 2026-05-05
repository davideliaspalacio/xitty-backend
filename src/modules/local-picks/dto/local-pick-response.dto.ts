import { ApiProperty } from '@nestjs/swagger';

export class LocalPickPlaceDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) slug: string | null;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) address: string | null;
  @ApiProperty({ nullable: true }) category_id: string | null;
  @ApiProperty() average_rating: number;
  @ApiProperty() total_reviews: number;
  @ApiProperty({ nullable: true }) cover_photo_url: string | null;
}

export class LocalPickResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() place_id: string;
  @ApiProperty() curator_name: string;
  @ApiProperty() pick_tag: string;
  @ApiProperty({ nullable: true }) short_pitch: string | null;
  @ApiProperty({ nullable: true }) hero_image_url: string | null;
  @ApiProperty() week_starts_at: string;
  @ApiProperty() week_ends_at: string;
  @ApiProperty() position: number;
  @ApiProperty() is_active: boolean;
  @ApiProperty({ nullable: true }) created_by: string | null;
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
  @ApiProperty({ nullable: true, type: LocalPickPlaceDto })
  place: LocalPickPlaceDto | null;
}

export class LocalPickListResponseDto {
  @ApiProperty({ type: [LocalPickResponseDto] }) data: LocalPickResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
