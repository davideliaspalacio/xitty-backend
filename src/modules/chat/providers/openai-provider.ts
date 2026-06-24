import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
  ChatProvider,
  ChatProviderMessage,
  PlaceSnippet,
} from './chat-provider.interface';

/**
 * Provider real usando la API de OpenAI (chat.completions).
 *
 * Se inicializa lazy: solo crea el cliente la primera vez que se llama generate.
 * Si OPENAI_API_KEY no esta definida en runtime, tira ServiceUnavailableException.
 * Modelo por defecto: gpt-4o-mini (rapido y economico, ideal para respuestas
 * cortas con RAG). Configurable via OPENAI_MODEL.
 */
@Injectable()
export class OpenAIChatProvider implements ChatProvider {
  private readonly logger = new Logger(OpenAIChatProvider.name);
  private client: OpenAI | null = null;
  private readonly modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  private getClient(): OpenAI {
    if (this.client) return this.client;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Chat AI provider not configured: missing OPENAI_API_KEY',
      );
    }
    this.client = new OpenAI({ apiKey });
    return this.client;
  }

  async generate(
    messages: ChatProviderMessage[],
    contextSnippets: PlaceSnippet[],
  ): Promise<string> {
    const client = this.getClient();

    // OpenAI usa los roles system/user/assistant directamente. Reemplazamos el
    // system original por uno enriquecido con los snippets del catalogo (RAG).
    const systemMsg = messages.find((m) => m.role === 'system');
    const systemInstruction = this.buildSystemInstruction(
      systemMsg?.content,
      contextSnippets,
    );

    const conversation: ChatCompletionMessageParam[] = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const oaMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemInstruction },
      ...conversation,
    ];

    try {
      const completion = await client.chat.completions.create({
        model: this.modelName,
        messages: oaMessages,
        temperature: 0.7,
        max_tokens: 500,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      return text || 'Lo siento, no pude generar una respuesta esta vez.';
    } catch (err: any) {
      this.logger.error(
        `OpenAI generation failed: ${err?.message ?? 'unknown error'}`,
      );
      throw new ServiceUnavailableException(
        'Chat AI temporalmente no disponible. Intenta de nuevo en unos segundos.',
      );
    }
  }

  private buildSystemInstruction(
    base: string | undefined,
    snippets: PlaceSnippet[],
  ): string {
    const baseText =
      base ??
      'Eres Xitty, un asistente turistico amigable de Barranquilla, Colombia. NO inventes precios ni horarios. Si no sabes, di que el usuario debe verificar en el sitio. Hablas español caribeño calido, sin tecnicismos.';

    if (snippets.length === 0) return baseText;

    const ctx = snippets
      .map((s, i) => {
        const parts: string[] = [`${i + 1}. ${s.name}`];
        if (s.category) parts.push(`(${s.category})`);
        if (s.average_rating) parts.push(`★ ${s.average_rating}`);
        if (s.address) parts.push(`— ${s.address}`);
        if (s.description) parts.push(`. ${s.description}`);
        return parts.join(' ');
      })
      .join('\n');

    return `${baseText}\n\nContexto del catalogo (usa estos lugares si son relevantes; no inventes otros):\n${ctx}`;
  }
}
