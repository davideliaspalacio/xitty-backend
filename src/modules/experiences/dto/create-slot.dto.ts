import {
  IsDateString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSlotDto {
  @ApiProperty({ example: '2026-05-15T14:00:00Z' })
  @IsDateString()
  starts_at: string;

  @ApiProperty({
    example: 8,
    description: 'Total seats available for this slot',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  capacity: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
