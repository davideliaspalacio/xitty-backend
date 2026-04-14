import { ApiProperty } from '@nestjs/swagger';

export class FavoriteToggleResponseDto {
  @ApiProperty() place_id: string;
  @ApiProperty() is_favorite: boolean;
}

export class FavoritePlaceDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() average_rating: number;
  @ApiProperty() total_reviews: number;
  @ApiProperty({ nullable: true }) price_range: number | null;
  @ApiProperty({ nullable: true }) cover_photo_url: string | null;
  @ApiProperty({ nullable: true })
  categories: { id: string; name: string; slug: string; icon: string | null } | null;
}

export class FavoriteItemDto {
  @ApiProperty({ type: FavoritePlaceDto }) place: FavoritePlaceDto;
  @ApiProperty() favorited_at: string;
}

export class FavoriteListResponseDto {
  @ApiProperty({ type: [FavoriteItemDto] }) data: FavoriteItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
