import { ApiProperty } from '@nestjs/swagger';

export class RecommendationPlaceCategoryDto {
  @ApiProperty({ required: false, nullable: true })
  id: string | null;

  @ApiProperty({ required: false, nullable: true })
  name: string | null;

  @ApiProperty({ required: false, nullable: true })
  slug: string | null;

  @ApiProperty({ required: false, nullable: true })
  icon: string | null;
}

export class RecommendationPlaceSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  slug: string | null;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;

  @ApiProperty({ required: false, nullable: true })
  address: string | null;

  @ApiProperty({ required: false, nullable: true })
  latitude: number | null;

  @ApiProperty({ required: false, nullable: true })
  longitude: number | null;

  @ApiProperty({ required: false, nullable: true })
  price_range: number | null;

  @ApiProperty()
  average_rating: number;

  @ApiProperty()
  total_reviews: number;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ required: false, nullable: true })
  category_id: string | null;

  @ApiProperty({ type: RecommendationPlaceCategoryDto, required: false, nullable: true })
  category: RecommendationPlaceCategoryDto | null;

  @ApiProperty({ required: false, nullable: true })
  cover_photo_url: string | null;
}

export class RecommendationItemDto {
  @ApiProperty({ type: RecommendationPlaceSummaryDto })
  place: RecommendationPlaceSummaryDto;

  @ApiProperty({ description: 'Score final del motor (0..1)' })
  score: number;

  @ApiProperty({
    description: 'Texto en español explicando por qué este lugar fue recomendado',
    example: 'Cerca de ti · Para pareja · Abierto ahora',
  })
  reason: string;
}

export class TodayRecommendationsResponseDto {
  @ApiProperty({ type: [RecommendationItemDto] })
  items: RecommendationItemDto[];

  @ApiProperty({
    description: 'Timestamp ISO 8601 de cuándo se generaron las recomendaciones',
  })
  generated_at: string;
}
