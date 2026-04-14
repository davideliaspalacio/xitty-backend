import { IsOptional, IsUUID, IsInt, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export enum PlaceSortBy {
  RATING = 'rating',
  PRICE = 'price',
  POPULARITY = 'popularity',
  NEWEST = 'newest',
  DISTANCE = 'distance',
}

export class PlaceListQueryDto extends PaginationDto {
  @ApiProperty({ description: 'Filter by category ID', required: false })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiProperty({
    description: 'Filter by price range (1-4)',
    required: false,
    minimum: 1,
    maximum: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  price_range?: number;

  @ApiProperty({
    description: 'Sort by field',
    enum: PlaceSortBy,
    required: false,
    default: PlaceSortBy.NEWEST,
  })
  @IsOptional()
  @IsEnum(PlaceSortBy)
  sort_by?: PlaceSortBy;

  @ApiProperty({ description: 'User latitude (for distance sort)', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({ description: 'User longitude (for distance sort)', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
