import {
  IsUUID,
  IsString,
  IsOptional,
  IsIn,
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

export const PICK_TAGS = ['favorito_local', 'secreto', 'autentico'] as const;
export type PickTag = (typeof PICK_TAGS)[number];

export class CreateLocalPickDto {
  @ApiProperty()
  @IsUUID()
  place_id: string;

  @ApiProperty({ example: '@andreainfluencer' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  curator_name: string;

  @ApiProperty({ enum: PICK_TAGS })
  @IsIn(PICK_TAGS as unknown as string[])
  pick_tag: PickTag;

  @ApiPropertyOptional({
    description: 'Curator pitch / personal recommendation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  short_pitch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  hero_image_url?: string;

  @ApiProperty({ example: '2026-05-04T00:00:00Z' })
  @IsDateString()
  week_starts_at: string;

  @ApiProperty({ example: '2026-05-10T23:59:59Z' })
  @IsDateString()
  week_ends_at: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  position?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
