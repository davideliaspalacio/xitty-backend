import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AudioTourQueryDto {
  @ApiProperty({
    description: 'Preferred language code',
    required: false,
    example: 'es',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/)
  lang?: string;
}
