import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  IsBoolean,
  IsUrl,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeaturedDto {
  @ApiProperty({
    description: 'Place to feature',
    example: '0d6b5c1c-3f2a-4b22-9d77-aeff6e3b1c00',
  })
  @IsUUID()
  place_id: string;

  @ApiProperty({
    description: 'Curator name (free text — admin team or influencer handle)',
    example: '@andreainfluencer',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  curator_name: string;

  @ApiProperty({
    description: 'Week start (ISO 8601)',
    example: '2026-04-27T00:00:00Z',
  })
  @IsDateString()
  week_starts_at: string;

  @ApiProperty({
    description: 'Week end (ISO 8601)',
    example: '2026-05-03T23:59:59Z',
  })
  @IsDateString()
  week_ends_at: string;

  @ApiPropertyOptional({
    description: 'Override the place name on the feature card',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  custom_title?: string;

  @ApiPropertyOptional({
    description: 'Curator pitch / personal recommendation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  custom_description?: string;

  @ApiPropertyOptional({ description: 'Override the cover photo URL' })
  @IsOptional()
  @IsUrl()
  hero_image_url?: string;

  @ApiPropertyOptional({
    description: 'Display order within the week (lower = first)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  position?: number;

  @ApiPropertyOptional({ description: 'Active flag', default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
