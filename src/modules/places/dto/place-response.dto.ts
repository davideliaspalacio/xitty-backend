import { ApiProperty } from '@nestjs/swagger';

export class PlacePhotoDto {
  @ApiProperty() id: string;
  @ApiProperty() url: string;
  @ApiProperty({ nullable: true }) alt_text: string | null;
  @ApiProperty() is_cover: boolean;
  @ApiProperty() display_order: number;
}

export class PlaceCategoryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ nullable: true }) icon: string | null;
}

export class PlaceCardDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) address: string | null;
  @ApiProperty({ nullable: true }) latitude: number | null;
  @ApiProperty({ nullable: true }) longitude: number | null;
  @ApiProperty({ nullable: true }) price_range: number | null;
  @ApiProperty() average_rating: number;
  @ApiProperty() total_reviews: number;
  @ApiProperty({ type: [String] }) tags: string[];
  @ApiProperty({ nullable: true, type: PlaceCategoryDto })
  categories: PlaceCategoryDto | null;
  @ApiProperty({ nullable: true }) cover_photo_url: string | null;
}

export class PlaceDetailDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) address: string | null;
  @ApiProperty({ nullable: true }) latitude: number | null;
  @ApiProperty({ nullable: true }) longitude: number | null;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty({ nullable: true }) website: string | null;
  @ApiProperty({ nullable: true }) price_range: number | null;
  @ApiProperty({ nullable: true }) schedule: Record<string, any> | null;
  @ApiProperty({ nullable: true }) category_id: string | null;
  @ApiProperty({ nullable: true, type: PlaceCategoryDto })
  categories: PlaceCategoryDto | null;
  @ApiProperty({ nullable: true }) owner_id: string | null;
  @ApiProperty({ type: [String] }) tags: string[];
  @ApiProperty() average_rating: number;
  @ApiProperty() total_reviews: number;
  @ApiProperty() is_active: boolean;
  @ApiProperty({ nullable: true }) slug: string | null;
  @ApiProperty({ nullable: true }) cta_phone: string | null;
  @ApiProperty({ nullable: true }) cta_whatsapp: string | null;
  @ApiProperty({ nullable: true }) reservation_url: string | null;
  @ApiProperty({ type: [PlacePhotoDto] }) photos: PlacePhotoDto[];
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
}

export class PlaceListResponseDto {
  @ApiProperty({ type: [PlaceCardDto] }) data: PlaceCardDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
