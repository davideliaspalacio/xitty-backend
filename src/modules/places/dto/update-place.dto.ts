import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreatePlaceDto } from './create-place.dto';

export class UpdatePlaceDto extends PartialType(CreatePlaceDto) {
  @ApiProperty({ description: 'Active status (admin only)', required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
