/**
 * Token de inyeccion para el provider de chat (Gemini real | Mock).
 * El module decide cual implementacion proveer segun NODE_ENV y GEMINI_API_KEY.
 */
export const CHAT_PROVIDER = 'CHAT_PROVIDER';

/**
 * Mensaje conversacional generico que se envia al LLM.
 */
export interface ChatProviderMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Snippet de contexto que el RAG inyecta al prompt (info de places del catalogo).
 */
export interface PlaceSnippet {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  address?: string | null;
  average_rating?: number | null;
  price_range?: number | null;
}

/**
 * Interface del provider. Una sola operacion: generar la respuesta del assistant
 * a partir del historial + snippets de contexto. NO maneja streaming en MVP.
 */
export interface ChatProvider {
  generate(
    messages: ChatProviderMessage[],
    contextSnippets: PlaceSnippet[],
  ): Promise<string>;
}
