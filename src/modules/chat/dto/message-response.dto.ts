import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ description: 'ID del mensaje' })
  id: string;

  @ApiProperty({ description: 'ID de la conversacion' })
  conversation_id: string;

  @ApiProperty({
    description: 'Rol del autor del mensaje',
    enum: ['user', 'assistant', 'system'],
  })
  role: 'user' | 'assistant' | 'system';

  @ApiProperty({ description: 'Contenido del mensaje' })
  content: string;

  @ApiProperty({
    description:
      'Metadata opcional. Para mensajes del assistant incluye context_place_ids.',
    required: false,
    nullable: true,
    type: Object,
  })
  metadata?: Record<string, any> | null;

  @ApiProperty({ description: 'Fecha de creacion ISO 8601' })
  created_at: string;
}

export class ConversationResponseDto {
  @ApiProperty({ description: 'ID de la conversacion' })
  id: string;

  @ApiProperty({ description: 'ID del usuario dueño' })
  user_id: string;

  @ApiProperty({
    description: 'Titulo de la conversacion',
    required: false,
    nullable: true,
  })
  title: string | null;

  @ApiProperty({ description: 'Fecha de creacion' })
  created_at: string;

  @ApiProperty({ description: 'Fecha de ultima actualizacion' })
  updated_at: string;
}

export class ConversationWithMessagesDto extends ConversationResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  messages: MessageResponseDto[];
}

export class CreateConversationResponseDto {
  @ApiProperty({ description: 'ID de la nueva conversacion' })
  conversation_id: string;

  @ApiProperty({
    description:
      'ID del primer mensaje (assistant) si first_message fue enviado, sino null',
    required: false,
    nullable: true,
  })
  first_message_id: string | null;
}
