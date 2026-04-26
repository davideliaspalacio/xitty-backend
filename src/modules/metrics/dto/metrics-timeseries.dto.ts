import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum TimeseriesGranularity {
  DAY = 'day',
  WEEK = 'week',
}

export class MetricsTimeseriesQueryDto {
  @ApiProperty({ description: 'Start date (ISO 8601)' })
  @IsDateString()
  from: string;

  @ApiProperty({ description: 'End date (ISO 8601)' })
  @IsDateString()
  to: string;

  @ApiProperty({
    description: 'Bucket granularity',
    enum: TimeseriesGranularity,
    default: TimeseriesGranularity.DAY,
    required: false,
  })
  @IsOptional()
  @IsEnum(TimeseriesGranularity)
  granularity?: TimeseriesGranularity;
}

export class MetricsTimeseriesBucketDto {
  @ApiProperty() bucket: string;
  @ApiProperty() views: number;
  @ApiProperty() calls: number;
  @ApiProperty() whatsapp: number;
  @ApiProperty() reservations: number;
  @ApiProperty() directions: number;
  @ApiProperty() promo_views: number;
  @ApiProperty() total: number;
}
