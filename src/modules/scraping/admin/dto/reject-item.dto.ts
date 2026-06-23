import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectScrapedItemDto {
  @ApiProperty({
    description: 'Razon humana del rechazo (visible para el equipo)',
    example: 'duplicado de #abc',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}
