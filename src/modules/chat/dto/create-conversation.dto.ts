import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    description: 'Titulo opcional para la conversacion',
    required: false,
    example: '¿Que hago hoy en Barranquilla?',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({
    description:
      'Primer mensaje del usuario (opcional). Si se pasa, se ejecuta sendMessage en linea.',
    required: false,
    example: 'Recomiendame una playa cerca de aqui',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  first_message?: string;
}
