import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { ScrapingSourceKind } from '../../storage/scraping-sources.repo';

export const SCRAPING_SOURCE_KINDS: ScrapingSourceKind[] = [
  'google_places',
  'eventbrite',
  'tavily',
  'firecrawl',
  'manual',
];

export class CreateScrapingSourceDto {
  @ApiProperty({ example: 'eventbrite-bquilla' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    enum: SCRAPING_SOURCE_KINDS,
    example: 'google_places',
  })
  @IsIn(SCRAPING_SOURCE_KINDS as unknown as string[])
  kind!: ScrapingSourceKind;

  @ApiPropertyOptional({
    description: 'Config arbitraria de la source (query, radius, etc.)',
    example: { query: 'Barranquilla', radius_m: 5000 },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Cron expresion (formato pg_cron). Null = solo manual.',
    example: '0 */6 * * *',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  schedule_cron?: string | null;
}
