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
  async generate(
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

    if (lower.includes('playa')) {
      return `Cerca de ti, Playa Salgar es la mas popular para visitar.${contextHint}`;
    }
    if (lower.includes('restaurante') || lower.includes('comer') || lower.includes('comida')) {
      return `Para comer rico en Barranquilla te recomiendo La Cueva o Vintrash.${contextHint}`;
    }
    if (lower.includes('hotel') || lower.includes('hospedaje')) {
      return `Para hospedarte el Hotel El Prado y el Movich son clasicos.${contextHint}`;
    }
    if (lower.includes('bar') || lower.includes('noche') || lower.includes('discoteca')) {
      return `Para vida nocturna, Frogg Leggz y La Troja son legendarios.${contextHint}`;
    }
    if (lower.includes('museo') || lower.includes('cultura')) {
      return `Visita el Museo del Caribe y el Museo Romantico.${contextHint}`;
    }
    if (lower.includes('tour') || lower.includes('experiencia')) {
      return `Te recomiendo un tour del centro historico o un city tour panoramico.${contextHint}`;
    }
    if (lower.includes('hola') || lower.includes('saludos') || lower.includes('buenas')) {
      return '¡Hola! Soy Xitty, tu asistente turistico de Barranquilla. ¿En que te puedo ayudar?';
    }
    return `Soy Xitty, tu asistente de Barranquilla. Cuentame que estas buscando: playa, comida, vida nocturna, museos o experiencias?${contextHint}`;
  }
}
