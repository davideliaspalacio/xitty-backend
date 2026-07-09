import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class MetricsRangeQueryDto {
  @ApiProperty({
    description: 'Start date (ISO 8601)',
    example: '2026-04-01T00:00:00Z',
  })
  @IsDateString()
  from: string;

  @ApiProperty({
    description: 'End date (ISO 8601)',
    example: '2026-04-30T23:59:59Z',
  })
  @IsDateString()
  to: string;
}

export class MetricsSummaryDto {
  @ApiProperty() total_views: number;
  @ApiProperty() total_calls: number;
  @ApiProperty() total_whatsapp: number;
  @ApiProperty() total_reservations: number;
  @ApiProperty() total_directions: number;
  @ApiProperty() total_promo_views: number;
  @ApiProperty() total_interactions: number;
  @ApiProperty() prev_total_views: number;
  @ApiProperty() prev_total_calls: number;
  @ApiProperty() prev_total_whatsapp: number;
  @ApiProperty() prev_total_reservations: number;
  @ApiProperty() prev_total_directions: number;
  @ApiProperty() prev_total_promo_views: number;
  @ApiProperty() prev_total_interactions: number;
  @ApiProperty() views_change_percent: number;
  @ApiProperty() calls_change_percent: number;
  @ApiProperty() whatsapp_change_percent: number;
  @ApiProperty() reservations_change_percent: number;
  @ApiProperty() directions_change_percent: number;
  @ApiProperty() promo_views_change_percent: number;
  @ApiProperty({ description: '% change vs previous period', example: 23.5 })
  change_percent: number;
  @ApiProperty() period: { from: string; to: string };
}
