import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ChatProvider,
  ChatProviderMessage,
  PlaceSnippet,
} from './chat-provider.interface';

/**
 * Provider real usando @google/generative-ai con modelo gemini-1.5-flash.
 *
 * Se inicializa lazy: solo crea el cliente la primera vez que se llama generate.
 * Si GEMINI_API_KEY no esta definida en runtime, tira ServiceUnavailableException.
 */
@Injectable()
export class GeminiChatProvider implements ChatProvider {
  private readonly logger = new Logger(GeminiChatProvider.name);
  private client: GoogleGenerativeAI | null = null;
  private readonly modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  private getClient(): GoogleGenerativeAI {
    if (this.client) return this.client;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Chat AI provider not configured: missing GEMINI_API_KEY',
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
    return this.client;
  }

  async generate(
    messages: ChatProviderMessage[],
    contextSnippets: PlaceSnippet[],
  ): Promise<string> {
    const client = this.getClient();

    // System prompt + context — Gemini soporta systemInstruction. Lo armamos a
    // partir del primer mensaje system si existe, y le agregamos los snippets.
    const systemMsg = messages.find((m) => m.role === 'system');
    const systemInstruction = this.buildSystemInstruction(
      systemMsg?.content,
      contextSnippets,
    );

    const model = client.getGenerativeModel({
      model: this.modelName,
      systemInstruction,
    });

    // Gemini chat history: role 'user' o 'model' (no 'assistant')
    const history = messages
      .filter((m) => m.role !== 'system')
      .slice(0, -1) // todos menos el ultimo (que sera el prompt)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const lastMessage = messages.filter((m) => m.role !== 'system').slice(-1)[0];
    if (!lastMessage) {
      throw new ServiceUnavailableException('No user message to respond to');
    }

    try {
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage.content);
      const text = result.response.text();
      return text || 'Lo siento, no pude generar una respuesta esta vez.';
    } catch (err: any) {
      this.logger.error(
        `Gemini generation failed: ${err?.message ?? 'unknown error'}`,
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
