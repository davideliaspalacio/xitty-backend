import {
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * PATCH parcial del enriched item desde el panel de moderacion. Solo campos
 * presentables: titulo/descripcion/ubicacion/fechas/precio. NO permite cambiar
 * `status` (eso va por approve/reject/publish).
 */
export class UpdateScrapedItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ description: 'Nombre legible del lugar / direccion' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ example: '2026-07-01T15:00:00Z' })
  @IsOptional()
  @IsISO8601()
  starts_at?: string;

  @ApiPropertyOptional({ example: '2026-07-01T18:00:00Z' })
  @IsOptional()
  @IsISO8601()
  ends_at?: string;

  @ApiPropertyOptional({ description: 'Precio en COP' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price_cop?: number;

  @ApiPropertyOptional({
    description: 'Pista de categoria (tour, restaurante, bar, evento, ...)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category_hint?: string;
}
