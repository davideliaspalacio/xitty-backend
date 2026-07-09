import { ApiProperty } from '@nestjs/swagger';

/**
 * Card publica del feed `discover/curated`.
 *
 * Es una representacion light pensada para listados, similar al
 * `PlaceCardDto`. Para el detalle (con `source_url`, `quality_score`,
 * `scraped_at`) usar `CuratedItemDetailDto`.
 */
export class CuratedItemCardDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({
    nullable: true,
    description: 'Hint de categoria libre (ej. evento, restaurante, tour)',
  })
  category: string | null;
  @ApiProperty({ nullable: true }) location_name: string | null;
  @ApiProperty({ nullable: true }) latitude: number | null;
  @ApiProperty({ nullable: true }) longitude: number | null;
  @ApiProperty({ nullable: true }) price_cop: number | null;
  @ApiProperty({ nullable: true }) image_url: string | null;
  @ApiProperty({ nullable: true }) starts_at: string | null;
  @ApiProperty({ nullable: true }) ends_at: string | null;
  @ApiProperty({
    description: 'Score 0..1 asignado por el pipeline de quality',
  })
  quality_score: number;
}

/**
 * Detalle de un item curado. Incluye `source_url` y `scraped_at` (de la
 * tabla `scraped_items_raw`) para auditoria y atribucion.
 */
export class SourceReviewDto {
  @ApiProperty({ nullable: true }) author: string | null;
  @ApiProperty({ nullable: true }) rating: number | null;
  @ApiProperty({ nullable: true }) text: string | null;
  @ApiProperty({ nullable: true }) relative_time: string | null;
  @ApiProperty({ nullable: true }) publish_time: string | null;
}

export class CuratedItemDetailDto extends CuratedItemCardDto {
  @ApiProperty({ nullable: true, description: 'URL original de la fuente' })
  source_url: string | null;
  @ApiProperty({ description: 'Timestamp ISO en que se scrapeo originalmente' })
  scraped_at: string;
  @ApiProperty({
    type: [SourceReviewDto],
    nullable: true,
    description: 'Reseñas importadas de la fuente (Google): display-only.',
  })
  source_reviews: SourceReviewDto[] | null;
}
