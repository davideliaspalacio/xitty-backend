import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateRankingConfigDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 1, example: 0.45 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  rating_weight?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, example: 0.25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  views_weight?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, example: 0.3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  conversions_weight?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 5, example: 4.2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating_prior?: number;

  @ApiPropertyOptional({ minimum: 0, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rating_prior_reviews?: number;

  @ApiPropertyOptional({ minimum: 1, example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  views_cap?: number;

  @ApiPropertyOptional({ minimum: 1, example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  conversions_cap?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 365, example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  window_days?: number;
}
