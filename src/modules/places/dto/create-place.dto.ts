import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsArray,
  IsUUID,
  IsUrl,
  IsObject,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePlaceDto {
  @ApiProperty({ description: 'Place name', example: 'La Trattoria' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'Place description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Street address', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'Operational city scope, e.g. Cartagena or Barranquilla',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiProperty({
    description: 'Neighborhood/zone inside the city',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  zone?: string;

  @ApiProperty({ description: 'Latitude', example: 10.9685, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({ description: 'Longitude', example: -74.7813, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Website URL', required: false })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiProperty({
    description: 'Price range (1=cheap, 4=expensive)',
    minimum: 1,
    maximum: 4,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  price_range?: number;

  @ApiProperty({
    description: 'Opening hours (JSON)',
    example: { mon: { open: '08:00', close: '18:00' } },
    required: false,
  })
  @IsOptional()
  @IsObject()
  schedule?: Record<string, any>;

  @ApiProperty({ description: 'Category ID', required: false })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiProperty({
    description: 'Tags for search',
    example: ['comida italiana', 'pizza'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description: 'URL slug for microsite (auto-generated from name if omitted)',
    example: 'la-trattoria',
    required: false,
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ description: 'Phone number for "Call" CTA', required: false })
  @IsOptional()
  @IsString()
  cta_phone?: string;

  @ApiProperty({
    description: 'WhatsApp number (international format) for "WhatsApp" CTA',
    required: false,
  })
  @IsOptional()
  @IsString()
  cta_whatsapp?: string;

  @ApiProperty({ description: 'External reservation URL', required: false })
  @IsOptional()
  @IsUrl()
  reservation_url?: string;
}
