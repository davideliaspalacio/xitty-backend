import {
  IsOptional,
  IsUUID,
  IsInt,
  IsEnum,
  IsNumber,
  IsString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TravelerType } from '../../preferences/dto/create-preferences.dto';

export enum PlaceSortBy {
  RATING = 'rating',
  PRICE = 'price',
  POPULARITY = 'popularity',
  NEWEST = 'newest',
  DISTANCE = 'distance',
}

export enum PlaceLang {
  ES = 'es',
  EN = 'en',
  FR = 'fr',
  PT = 'pt',
}

export class PlaceListQueryDto extends PaginationDto {
  @ApiProperty({ description: 'Filter by category ID', required: false })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiProperty({
    description: 'Filter by operational city, e.g. Cartagena or Barranquilla',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiProperty({
    description: 'Filter by neighborhood/zone inside the city',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  zone?: string;

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

  @ApiProperty({
    description: 'User latitude (for distance sort)',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({
    description: 'User longitude (for distance sort)',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({
    description:
      'Filter by traveler type — matches places with this value in tags[]',
    enum: TravelerType,
    required: false,
  })
  @IsOptional()
  @IsEnum(TravelerType)
  traveler_type?: TravelerType;

  @ApiProperty({
    description:
      'Localize name + description into this language (falls back to es when missing)',
    enum: PlaceLang,
    required: false,
    default: PlaceLang.ES,
  })
  @IsOptional()
  @IsEnum(PlaceLang)
  lang?: PlaceLang;
}
