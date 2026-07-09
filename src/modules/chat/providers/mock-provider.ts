import { Injectable } from '@nestjs/common';
import {
  ChatProvider,
  ChatProviderMessage,
  PlaceSnippet,
} from './chat-provider.interface';

/**
 * Implementacion mock para tests y para entornos sin OPENAI_API_KEY.
 * Hace keyword matching simple sobre el ultimo mensaje del usuario.
 */
@Injectable()
export class MockChatProvider implements ChatProvider {
  generate(
    messages: ChatProviderMessage[],
    contextSnippets: PlaceSnippet[],
  ): Promise<string> {
    const lastUserMsg =
      [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const lower = lastUserMsg.toLowerCase();

    const contextHint =
      contextSnippets.length > 0
        ? ` Te sugiero echar un ojo a ${contextSnippets
            .slice(0, 3)
            .map((s) => s.name)
            .join(', ')}.`
        : '';

    let reply: string;
    if (lower.includes('playa')) {
      reply = `Cerca de ti, Playa Salgar es la mas popular para visitar.${contextHint}`;
    } else if (
      lower.includes('restaurante') ||
      lower.includes('comer') ||
      lower.includes('comida')
    ) {
      reply = `Para comer rico en Barranquilla te recomiendo La Cueva o Vintrash.${contextHint}`;
    } else if (lower.includes('hotel') || lower.includes('hospedaje')) {
      reply = `Para hospedarte el Hotel El Prado y el Movich son clasicos.${contextHint}`;
    } else if (
      lower.includes('bar') ||
      lower.includes('noche') ||
      lower.includes('discoteca')
    ) {
      reply = `Para vida nocturna, Frogg Leggz y La Troja son legendarios.${contextHint}`;
    } else if (lower.includes('museo') || lower.includes('cultura')) {
      reply = `Visita el Museo del Caribe y el Museo Romantico.${contextHint}`;
    } else if (lower.includes('tour') || lower.includes('experiencia')) {
      reply = `Te recomiendo un tour del centro historico o un city tour panoramico.${contextHint}`;
    } else if (
      lower.includes('hola') ||
      lower.includes('saludos') ||
      lower.includes('buenas')
    ) {
      reply =
        '¡Hola! Soy Xitty, tu asistente turistico de Barranquilla. ¿En que te puedo ayudar?';
    } else {
      reply = `Soy Xitty, tu asistente de Barranquilla. Cuentame que estas buscando: playa, comida, vida nocturna, museos o experiencias?${contextHint}`;
    }

    return Promise.resolve(reply);
  }
}
