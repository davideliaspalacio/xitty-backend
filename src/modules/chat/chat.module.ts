import { Module, Provider } from '@nestjs/common';

import { DatabaseModule } from '../../config/database.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ContextService } from './rag/context.service';
import { ChatRateLimitService } from './rate-limit.service';
import { CHAT_PROVIDER } from './providers/chat-provider.interface';
import { GeminiChatProvider } from './providers/gemini-provider';
import { MockChatProvider } from './providers/mock-provider';

/**
 * Selecciona la implementacion del provider:
 *  - Si NODE_ENV === 'test' → MockChatProvider (siempre)
 *  - Si GEMINI_API_KEY definida → GeminiChatProvider
 *  - Sino → MockChatProvider (deja la API funcionar localmente sin la key)
 *
 * NOTA: GeminiChatProvider tira ServiceUnavailableException en runtime si la
 * key no esta presente — pero como esta seleccion ocurre al boot del modulo,
 * preferimos caer al mock para no romper el arranque del app.
 */
function selectChatProvider(): Provider {
  const isTest = process.env.NODE_ENV === 'test';
  const hasKey = !!process.env.GEMINI_API_KEY;

  if (!isTest && hasKey) {
    return {
      provide: CHAT_PROVIDER,
      useClass: GeminiChatProvider,
    };
  }
  return {
    provide: CHAT_PROVIDER,
    useClass: MockChatProvider,
  };
}

@Module({
  imports: [DatabaseModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ContextService,
    ChatRateLimitService,
    selectChatProvider(),
  ],
  exports: [ChatService],
})
export class ChatModule {}
