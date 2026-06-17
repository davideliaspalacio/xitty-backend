import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { ChatService } from './chat.service';
import { ContextService } from './rag/context.service';
import { ChatRateLimitService } from './rate-limit.service';
import {
  CHAT_PROVIDER,
  ChatProvider,
  ChatProviderMessage,
  PlaceSnippet,
} from './providers/chat-provider.interface';

// ── Supabase chain mock ─────────────────────────────────────────────────────
function createChain(result: any) {
  const chain: any = {};
  const methods = [
    'from', 'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'in', 'order', 'range', 'limit',
    'single', 'maybeSingle',
  ];
  methods.forEach((m) => (chain[m] = jest.fn().mockReturnValue(chain)));
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createMockSupabase() {
  const mock: any = { from: jest.fn(), rpc: jest.fn() };
  mock._on = (data: any, error?: any, count?: number) => {
    const c = createChain({ data, error: error || null, count: count ?? null });
    mock.from.mockReturnValueOnce(c);
    return c;
  };
  mock.from.mockImplementation(() =>
    createChain({ data: null, error: null, count: null }),
  );
  return mock;
}

// ── Trackable fake provider ─────────────────────────────────────────────────
class FakeProvider implements ChatProvider {
  calls: { messages: ChatProviderMessage[]; snippets: PlaceSnippet[] }[] = [];
  reply = 'respuesta canned del fake provider';

  async generate(
    messages: ChatProviderMessage[],
    snippets: PlaceSnippet[],
  ): Promise<string> {
    this.calls.push({ messages, snippets });
    return this.reply;
  }
}

describe('ChatService', () => {
  let service: ChatService;
  let supabase: any;
  let provider: FakeProvider;
  let context: jest.Mocked<ContextService>;
  let rateLimit: jest.Mocked<ChatRateLimitService>;

  const USER_ID = 'user-1';
  const CONV_ID = 'conv-1';

  beforeEach(async () => {
    supabase = createMockSupabase();
    provider = new FakeProvider();

    context = {
      extractEntities: jest.fn().mockReturnValue([]),
      getSnippetsFor: jest.fn().mockResolvedValue([]),
    } as any;

    rateLimit = {
      checkAndIncrement: jest.fn().mockResolvedValue(1),
      limit: 30,
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: 'SUPABASE_CLIENT', useValue: supabase },
        { provide: CHAT_PROVIDER, useValue: provider },
        { provide: ContextService, useValue: context },
        { provide: ChatRateLimitService, useValue: rateLimit },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  // ────────────────────────────────────────────────────────────────────────
  // createConversation
  // ────────────────────────────────────────────────────────────────────────
  describe('createConversation', () => {
    it('persiste y retorna conversation_id', async () => {
      supabase._on({ id: CONV_ID }); // insert .select.single

      const result = await service.createConversation(USER_ID, {});

      expect(result.conversation_id).toBe(CONV_ID);
      expect(result.first_message_id).toBeNull();
    });

    it('si viene first_message, envia y retorna el id del assistant reply', async () => {
      // 1) insert conversation -> id
      supabase._on({ id: CONV_ID });
      // sendMessage internals:
      //   a) fetchOwnedConversation
      supabase._on({ id: CONV_ID, user_id: USER_ID });
      //   b) insert user message
      supabase._on({
        id: 'msg-user-1',
        conversation_id: CONV_ID,
        role: 'user',
        content: 'hola',
        metadata: null,
        created_at: 'now',
      });
      //   c) fetch recent messages
      supabase._on([
        {
          id: 'msg-user-1',
          conversation_id: CONV_ID,
          role: 'user',
          content: 'hola',
          metadata: null,
          created_at: 'now',
        },
      ]);
      //   d) insert assistant message
      supabase._on({
        id: 'msg-assistant-1',
        conversation_id: CONV_ID,
        role: 'assistant',
        content: 'hi',
        metadata: null,
        created_at: 'now',
      });
      //   e) bump updated_at (best effort)
      supabase._on(null);

      const result = await service.createConversation(USER_ID, {
        first_message: 'hola',
      });
      expect(result.conversation_id).toBe(CONV_ID);
      expect(result.first_message_id).toBe('msg-assistant-1');
    });

    it('tira BadRequestException si supabase falla al insertar', async () => {
      supabase._on(null, { message: 'db down' });
      await expect(service.createConversation(USER_ID, {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // listConversations
  // ────────────────────────────────────────────────────────────────────────
  describe('listConversations', () => {
    it('devuelve lista ordenada del usuario', async () => {
      supabase._on([
        { id: 'c1', user_id: USER_ID, title: 'A', created_at: 'x', updated_at: 'y' },
      ]);
      const result = await service.listConversations(USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // getConversation
  // ────────────────────────────────────────────────────────────────────────
  describe('getConversation', () => {
    it('devuelve la conversation con messages ordenados', async () => {
      supabase._on({
        id: CONV_ID,
        user_id: USER_ID,
        title: null,
        created_at: 'a',
        updated_at: 'b',
      });
      supabase._on([
        { id: 'm1', conversation_id: CONV_ID, role: 'user', content: 'hola', metadata: null, created_at: 't1' },
        { id: 'm2', conversation_id: CONV_ID, role: 'assistant', content: 'hi', metadata: null, created_at: 't2' },
      ]);

      const result = await service.getConversation(USER_ID, CONV_ID);
      expect(result.id).toBe(CONV_ID);
      expect(result.messages).toHaveLength(2);
    });

    it('tira 404 si la conversation no existe', async () => {
      supabase._on(null);
      await expect(service.getConversation(USER_ID, CONV_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('tira 403 si la conversation pertenece a otro user', async () => {
      supabase._on({ id: CONV_ID, user_id: 'OTRO', title: null, created_at: 'a', updated_at: 'b' });
      await expect(service.getConversation(USER_ID, CONV_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // sendMessage
  // ────────────────────────────────────────────────────────────────────────
  describe('sendMessage', () => {
    function mockHappyPath(opts: {
      recentMessages?: any[];
      snippets?: PlaceSnippet[];
      assistantMessage?: any;
    } = {}) {
      // a) fetchOwnedConversation
      supabase._on({ id: CONV_ID, user_id: USER_ID, title: null, created_at: 'a', updated_at: 'b' });
      // b) insert user message
      supabase._on({
        id: 'm-user',
        conversation_id: CONV_ID,
        role: 'user',
        content: 'hola',
        metadata: null,
        created_at: 'now',
      });
      // c) fetch recent
      const recent = opts.recentMessages ?? [
        { id: 'm-user', conversation_id: CONV_ID, role: 'user', content: 'hola', metadata: null, created_at: 'now' },
      ];
      supabase._on(recent);
      // d) insert assistant message
      supabase._on(
        opts.assistantMessage ?? {
          id: 'm-assistant',
          conversation_id: CONV_ID,
          role: 'assistant',
          content: provider.reply,
          metadata: opts.snippets && opts.snippets.length ? { context_place_ids: opts.snippets.map(s => s.id) } : null,
          created_at: 'now',
        },
      );
      // e) bump updated_at
      supabase._on(null);

      if (opts.snippets) {
        context.getSnippetsFor.mockResolvedValueOnce(opts.snippets);
      }
    }

    it('llama al provider con system prompt + recent messages', async () => {
      mockHappyPath();

      await service.sendMessage(USER_ID, CONV_ID, 'hola');

      expect(provider.calls).toHaveLength(1);
      const call = provider.calls[0];
      expect(call.messages[0].role).toBe('system');
      expect(call.messages[0].content).toContain('Xitty');
      expect(call.messages[call.messages.length - 1].role).toBe('user');
      expect(call.messages[call.messages.length - 1].content).toBe('hola');
    });

    it('persiste tanto user message como assistant message', async () => {
      mockHappyPath();
      const result = await service.sendMessage(USER_ID, CONV_ID, 'hola');

      // Verificar inserts: from() llamada 5 veces (own, insert user, recent, insert assistant, bump)
      const fromCalls = (supabase.from as jest.Mock).mock.calls.map(c => c[0]);
      expect(fromCalls).toEqual([
        'chat_conversations',
        'chat_messages',
        'chat_messages',
        'chat_messages',
        'chat_conversations',
      ]);
      expect(result.role).toBe('assistant');
      expect(result.id).toBe('m-assistant');
    });

    it('rechaza con ForbiddenException si rate limit excede', async () => {
      // ownership ok
      supabase._on({ id: CONV_ID, user_id: USER_ID, title: null, created_at: 'a', updated_at: 'b' });
      rateLimit.checkAndIncrement.mockRejectedValueOnce(
        new ForbiddenException('limit excedido'),
      );
      await expect(service.sendMessage(USER_ID, CONV_ID, 'hola')).rejects.toThrow(
        ForbiddenException,
      );
      // provider no debe haberse llamado
      expect(provider.calls).toHaveLength(0);
    });

    it('rechaza con 404 si la conversation no existe', async () => {
      supabase._on(null);
      await expect(service.sendMessage(USER_ID, CONV_ID, 'hola')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza con 403 si la conversation es de otro user', async () => {
      supabase._on({ id: CONV_ID, user_id: 'OTRO', title: null, created_at: 'a', updated_at: 'b' });
      await expect(service.sendMessage(USER_ID, CONV_ID, 'hola')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rechaza con BadRequest si el content esta vacio', async () => {
      await expect(service.sendMessage(USER_ID, CONV_ID, '   ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('incluye context snippets cuando el mensaje matchea keyword', async () => {
      const snippets: PlaceSnippet[] = [
        { id: 'place-1', name: 'Playa Salgar', average_rating: 4.5 },
        { id: 'place-2', name: 'Playa Pradomar', average_rating: 4.2 },
      ];
      mockHappyPath({ snippets });

      const result = await service.sendMessage(USER_ID, CONV_ID, 'quiero ir a la playa');

      expect(provider.calls[0].snippets).toEqual(snippets);
      // metadata del assistant message persistido (chequeable via insertCall args)
      const insertCalls = (supabase.from as jest.Mock).mock.results
        .map((r: any, i: number) => ({ name: (supabase.from as jest.Mock).mock.calls[i][0], chain: r.value }))
        .filter((x: any) => x.name === 'chat_messages');
      // hay 3 calls a chat_messages: insert user, select recent, insert assistant
      const assistantInsertChain = insertCalls[2].chain;
      expect(assistantInsertChain.insert).toHaveBeenCalled();
      const insertedRow = assistantInsertChain.insert.mock.calls[0][0];
      expect(insertedRow.role).toBe('assistant');
      expect(insertedRow.metadata).toEqual({
        context_place_ids: ['place-1', 'place-2'],
      });
      expect(result.role).toBe('assistant');
    });

    it('continua sin snippets si el RAG falla', async () => {
      context.getSnippetsFor.mockRejectedValueOnce(new Error('db down'));
      mockHappyPath();

      const result = await service.sendMessage(USER_ID, CONV_ID, 'hola');

      expect(provider.calls[0].snippets).toEqual([]);
      expect(result.role).toBe('assistant');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // deleteConversation
  // ────────────────────────────────────────────────────────────────────────
  describe('deleteConversation', () => {
    it('elimina si es del user', async () => {
      supabase._on({ id: CONV_ID, user_id: USER_ID, title: null, created_at: 'a', updated_at: 'b' });
      supabase._on(null);
      await expect(
        service.deleteConversation(USER_ID, CONV_ID),
      ).resolves.toBeUndefined();
    });

    it('tira 403 si no es del user', async () => {
      supabase._on({ id: CONV_ID, user_id: 'OTRO', title: null, created_at: 'a', updated_at: 'b' });
      await expect(
        service.deleteConversation(USER_ID, CONV_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('tira 404 si la conversation no existe', async () => {
      supabase._on(null);
      await expect(
        service.deleteConversation(USER_ID, CONV_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
