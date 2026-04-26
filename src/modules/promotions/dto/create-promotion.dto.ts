import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePromotionDto {
  @ApiProperty({ description: 'Promotion title', example: '2x1 en pizzas' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Promotion description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    description: 'Discount percentage (0-100)',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discount_percentage?: number;

  @ApiProperty({ description: 'Start date (ISO 8601)', example: '2026-04-20T00:00:00Z' })
  @IsDateString()
  starts_at: string;

  @ApiProperty({ description: 'End date (ISO 8601)', example: '2026-04-30T23:59:59Z' })
  @IsDateString()
  ends_at: string;

  @ApiProperty({ description: 'Active flag', default: true, required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
