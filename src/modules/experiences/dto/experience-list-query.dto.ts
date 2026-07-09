import {
  IsOptional,
  IsInt,
  IsIn,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EXPERIENCE_TYPES } from './create-experience.dto';
import type { ExperienceType } from './create-experience.dto';

export const EXPERIENCE_SORT = [
  'rating',
  'price_asc',
  'price_desc',
  'duration',
  'created_at',
] as const;
export type ExperienceSort = (typeof EXPERIENCE_SORT)[number];

function parseTags(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export class ExperienceListQueryDto {
  @ApiPropertyOptional({ enum: EXPERIENCE_TYPES })
  @IsOptional()
  @IsIn(EXPERIENCE_TYPES as unknown as string[])
  experience_type?: ExperienceType;

  @ApiPropertyOptional({
    description: 'Comma-separated tags',
    example: 'romantico,relax',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseTags(value))
  tags?: string[];

  @ApiPropertyOptional({ example: 30000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_price?: number;

  @ApiPropertyOptional({ example: 200000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_price?: number;

  @ApiPropertyOptional({ description: 'Minimum duration in minutes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  min_duration?: number;

  @ApiPropertyOptional({ description: 'Maximum duration in minutes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_duration?: number;

  @ApiPropertyOptional({
    description:
      'Filter to experiences with at least one available slot on this date',
  })
  @IsOptional()
  @IsDateString()
  available_on?: string;

  @ApiPropertyOptional({ enum: EXPERIENCE_SORT, default: 'rating' })
  @IsOptional()
  @IsIn(EXPERIENCE_SORT as unknown as string[])
  sort_by?: ExperienceSort;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
