import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsInt,
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsIn,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const EXPERIENCE_TYPES = [
  'tour',
  'workshop',
  'gastronomy',
  'adventure',
  'wellness',
  'cultural',
  'nightlife',
] as const;
export type ExperienceType = (typeof EXPERIENCE_TYPES)[number];

export class CreateExperienceDto {
  @ApiProperty({ description: 'Operator place id (the host business)' })
  @IsUUID()
  operator_place_id: string;

  @ApiProperty({ example: 'Tour gastronomico por Barranquilla' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    description: 'URL slug — auto-generated from title if omitted',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiProperty({ enum: EXPERIENCE_TYPES })
  @IsIn(EXPERIENCE_TYPES as unknown as string[])
  experience_type: ExperienceType;

  @ApiPropertyOptional({
    type: [String],
    example: ['romantico', 'gastronomico'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];

  @ApiProperty({ example: 180, description: 'Duration in minutes' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration_minutes: number;

  @ApiProperty({ example: 80000, description: 'Price per person in COP' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price_cop: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  min_participants?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  max_participants?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meeting_point_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  meeting_point_latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  meeting_point_longitude?: number;

  @ApiPropertyOptional({
    default: 24,
    description: 'Hours before start to allow cancellation',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(720)
  cancellation_hours?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
