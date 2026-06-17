import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthGuard } from '../../common/guards/auth.guard';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { PostMessageDto } from './dto/post-message.dto';
import {
  ConversationResponseDto,
  ConversationWithMessagesDto,
  CreateConversationResponseDto,
  MessageResponseDto,
} from './dto/message-response.dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Lista las conversaciones del usuario (mas reciente primero)' })
  @ApiResponse({ status: 200, type: [ConversationResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list(@Request() req: any): Promise<ConversationResponseDto[]> {
    return this.chatService.listConversations(req.user.id);
  }

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Crea una nueva conversacion. Si first_message viene, lo envia y retorna el id del assistant reply.',
  })
  @ApiBody({ type: CreateConversationDto })
  @ApiResponse({ status: 201, type: CreateConversationResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Rate limit excedido' })
  async create(
    @Request() req: any,
    @Body() dto: CreateConversationDto,
  ): Promise<CreateConversationResponseDto> {
    return this.chatService.createConversation(req.user.id, dto);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Trae la conversacion con todos sus mensajes ordenados' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ConversationWithMessagesDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'No es tu conversacion' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getOne(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ConversationWithMessagesDto> {
    return this.chatService.getConversation(req.user.id, id);
  }

  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Envia un mensaje del usuario y retorna el mensaje del assistant (no streaming).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: PostMessageDto })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Rate limit excedido o no es tu conversacion' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async postMessage(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PostMessageDto,
  ): Promise<MessageResponseDto> {
    return this.chatService.sendMessage(req.user.id, id, dto.content);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina la conversacion y todos sus mensajes (cascade)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Eliminada' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'No es tu conversacion' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async delete(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.chatService.deleteConversation(req.user.id, id);
  }
}
