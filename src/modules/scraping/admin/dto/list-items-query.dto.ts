import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

import type { EnrichedStatus } from '../../storage/scraped-items.repo';

export const ENRICHED_STATUSES: EnrichedStatus[] = [
  'pending',
  'approved',
  'rejected',
  'published',
];

export class ListItemsQueryDto {
  @ApiPropertyOptional({
    enum: ENRICHED_STATUSES,
    default: 'pending',
  })
  @IsOptional()
  @IsIn(ENRICHED_STATUSES as unknown as string[])
  status?: EnrichedStatus;

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
