import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePlacePhotoDto {
  @ApiProperty({ description: 'Photo URL' })
  @IsString()
  url: string;

  @ApiProperty({ description: 'Alt text', required: false })
  @IsOptional()
  @IsString()
  alt_text?: string;

  @ApiProperty({
    description: 'Is cover photo',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_cover?: boolean;

  @ApiProperty({ description: 'Display order', default: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  display_order?: number;
}
