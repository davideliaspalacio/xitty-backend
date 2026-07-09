import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'sí'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return Boolean(value);
}

export class ListPlaceCompletenessQueryDto {
  @ApiPropertyOptional({ description: 'Filter report by city, e.g. Cartagena' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Filter report by zone/neighborhood' })
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional({ description: 'Filter report by category_id' })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description:
      'When true, returns only places with at least one missing field',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  missing_only?: boolean;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
