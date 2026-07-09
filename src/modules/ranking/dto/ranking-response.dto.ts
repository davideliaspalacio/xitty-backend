import { ApiProperty } from '@nestjs/swagger';

export class RankingPlaceDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) slug: string | null;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) address: string | null;
  @ApiProperty({ nullable: true }) category_id: string | null;
  @ApiProperty({ nullable: true }) city: string | null;
  @ApiProperty({ nullable: true }) zone: string | null;
  @ApiProperty() average_rating: number;
  @ApiProperty() total_reviews: number;
  @ApiProperty({ nullable: true }) cover_photo_url: string | null;
}

export class RankingItemDto {
  @ApiProperty() position: number;
  @ApiProperty({ nullable: true, description: 'Position one snapshot ago' })
  previous_position: number | null;
  @ApiProperty({
    nullable: true,
    description: 'Positive = climbed, negative = dropped, 0 = same',
  })
  position_change: number | null;
  @ApiProperty() score: number;
  @ApiProperty() views_30d: number;
  @ApiProperty() conversions_30d: number;
  @ApiProperty() is_sponsored: boolean;
  @ApiProperty({
    nullable: true,
    description: 'Display label when item is sponsored',
  })
  sponsored_label: string | null;
  @ApiProperty({ type: RankingPlaceDto }) place: RankingPlaceDto;
}

export class RankingListResponseDto {
  @ApiProperty({ type: [RankingItemDto] }) data: RankingItemDto[];
  @ApiProperty({ nullable: true }) category_id: string | null;
  @ApiProperty({ nullable: true }) city: string | null;
  @ApiProperty() limit: number;
}
