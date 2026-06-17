import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { CHAT_PROVIDER } from './providers/chat-provider.interface';
import type {
  ChatProvider,
  ChatProviderMessage,
  PlaceSnippet,
} from './providers/chat-provider.interface';
import { ContextService } from './rag/context.service';
import { ChatRateLimitService } from './rate-limit.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import {
  ConversationResponseDto,
  ConversationWithMessagesDto,
  CreateConversationResponseDto,
  MessageResponseDto,
} from './dto/message-response.dto';

const CONVERSATIONS_TABLE = 'chat_conversations';
const MESSAGES_TABLE = 'chat_messages';

const SYSTEM_PROMPT_BASE =
  'Eres Xitty, un asistente turistico amigable de Barranquilla, Colombia. ' +
  'NO inventes precios ni horarios. Si no sabes, di que el usuario debe verificar en el sitio. ' +
  'Hablas español caribeño calido, sin tecnicismos.';

const RECENT_MESSAGES_LIMIT = 10;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
    @Inject(CHAT_PROVIDER)
    private readonly provider: ChatProvider,
    private readonly contextService: ContextService,
    private readonly rateLimit: ChatRateLimitService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  // Conversations CRUD
  // ────────────────────────────────────────────────────────────────────────

  async listConversations(userId: string): Promise<ConversationResponseDto[]> {
    const { data, error } = await this.supabase
      .from(CONVERSATIONS_TABLE)
      .select('id, user_id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as ConversationResponseDto[];
  }

  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationWithMessagesDto> {
    const conv = await this.fetchOwnedConversation(userId, conversationId);

    const { data: msgs, error: msgErr } = await this.supabase
      .from(MESSAGES_TABLE)
      .select('id, conversation_id, role, content, metadata, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgErr) throw new BadRequestException(msgErr.message);

    return {
      ...conv,
      messages: (msgs ?? []) as MessageResponseDto[],
    };
  }

  /**
   * Crea una nueva conversacion. Si dto.first_message viene, envia ese mensaje
   * inmediatamente y retorna el id del mensaje del assistant.
   */
  async createConversation(
    userId: string,
    dto: CreateConversationDto,
  ): Promise<CreateConversationResponseDto> {
    const { data, error } = await this.supabase
      .from(CONVERSATIONS_TABLE)
      .insert({ user_id: userId, title: dto.title ?? null })
      .select('id')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'No se pudo crear la conversacion',
      );
    }

    const conversationId = (data as any).id as string;

    let firstMessageId: string | null = null;
    if (dto.first_message && dto.first_message.trim().length > 0) {
      const assistantMsg = await this.sendMessage(
        userId,
        conversationId,
        dto.first_message,
      );
      firstMessageId = assistantMsg.id;
    }

    return {
      conversation_id: conversationId,
      first_message_id: firstMessageId,
    };
  }

  async deleteConversation(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    await this.fetchOwnedConversation(userId, conversationId);

    const { error } = await this.supabase
      .from(CONVERSATIONS_TABLE)
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) throw new BadRequestException(error.message);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Envio de mensajes
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Envia un user message a la conversacion, llama al provider con contexto y
   * persiste la respuesta del assistant. Devuelve el message del assistant.
   *
   * Flujo:
   *   a) rate limit
   *   b) persist user message
   *   c) cargar last 10 messages
   *   d) RAG: context snippets segun el texto del usuario
   *   e) provider.generate(system + history + context)
   *   f) persist assistant message con metadata { context_place_ids }
   *   g) bump conversation.updated_at
   */
  async sendMessage(
    userId: string,
    conversationId: string,
    content: string,
  ): Promise<MessageResponseDto> {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('El mensaje no puede estar vacio');
    }

    // a) ownership + rate limit ───────────────────────────────────────────
    await this.fetchOwnedConversation(userId, conversationId);
    await this.rateLimit.checkAndIncrement(userId);

    // b) persist user message ──────────────────────────────────────────────
    const userMessage = await this.insertMessage(
      conversationId,
      'user',
      content,
      null,
    );

    // c) cargar recent messages (incluye el que acabamos de insertar) ──────
    const recentMessages = await this.fetchRecentMessages(conversationId);

    // d) RAG snippets ──────────────────────────────────────────────────────
    let snippets: PlaceSnippet[] = [];
    try {
      snippets = await this.contextService.getSnippetsFor(content);
    } catch (err: any) {
      this.logger.warn(`RAG fetch failed, continuing without context: ${err?.message}`);
      snippets = [];
    }

    // e) provider.generate ─────────────────────────────────────────────────
    const providerMessages: ChatProviderMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT_BASE },
      ...recentMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const reply = await this.provider.generate(providerMessages, snippets);

    // f) persist assistant message ─────────────────────────────────────────
    const metadata =
      snippets.length > 0
        ? { context_place_ids: snippets.map((s) => s.id) }
        : null;

    const assistantMessage = await this.insertMessage(
      conversationId,
      'assistant',
      reply,
      metadata,
    );

    // g) bump conversation updated_at (best-effort, no rompe si falla) ─────
    await this.supabase
      .from(CONVERSATIONS_TABLE)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return assistantMessage;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Helpers privados
  // ────────────────────────────────────────────────────────────────────────

  private async fetchOwnedConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationResponseDto> {
    const { data, error } = await this.supabase
      .from(CONVERSATIONS_TABLE)
      .select('id, user_id, title, created_at, updated_at')
      .eq('id', conversationId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Conversation not found');
    if ((data as any).user_id !== userId) {
      throw new ForbiddenException('No tienes acceso a esta conversacion');
    }
    return data as ConversationResponseDto;
  }

  private async fetchRecentMessages(
    conversationId: string,
  ): Promise<MessageResponseDto[]> {
    const { data, error } = await this.supabase
      .from(MESSAGES_TABLE)
      .select('id, conversation_id, role, content, metadata, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(RECENT_MESSAGES_LIMIT);

    if (error) throw new BadRequestException(error.message);
    const rows = (data ?? []) as MessageResponseDto[];
    // Reverse to chronological order
    return rows.reverse();
  }

  private async insertMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata: Record<string, any> | null,
  ): Promise<MessageResponseDto> {
    const { data, error } = await this.supabase
      .from(MESSAGES_TABLE)
      .insert({
        conversation_id: conversationId,
        role,
        content,
        metadata,
      })
      .select('id, conversation_id, role, content, metadata, created_at')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'No se pudo guardar el mensaje',
      );
    }
    return data as MessageResponseDto;
  }
}
