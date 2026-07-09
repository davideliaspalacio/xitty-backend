import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RecordImpressionDto {
  @ApiProperty({
    description: 'Stable anonymous browser session id. Stored only as a hash.',
    required: false,
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  anonymous_session_id?: string;
}
