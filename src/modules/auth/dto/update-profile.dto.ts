import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'David Elias Palacio',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  full_name?: string;

  @ApiProperty({
    description: 'Teléfono del usuario',
    example: '+573001234567',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
