import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * PATCH parcial de una source. Solo se aceptan campos mutables — `kind`
 * y `name` se cambian con upsert (POST).
 */
export class UpdateScrapingSourceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: '0 */6 * * *' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  schedule_cron?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
