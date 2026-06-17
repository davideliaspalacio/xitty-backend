import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class PostMessageDto {
  @ApiProperty({
    description: 'Contenido del mensaje del usuario',
    example: '¿Que playa me recomiendas cerca de Bocagrande?',
    maxLength: 4000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}
