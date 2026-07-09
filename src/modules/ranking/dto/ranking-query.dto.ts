import {
  IsOptional,
  IsInt,
  IsString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RankingQueryDto {
  @ApiPropertyOptional({
    description: 'Max items to return',
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter ranking by city, e.g. Cartagena or Barranquilla',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;
}
