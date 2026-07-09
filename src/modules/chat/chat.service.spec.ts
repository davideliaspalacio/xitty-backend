import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

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
interface MockDbError {
  message: string;
}

interface MockDbResult {
  data: unknown;
  error: MockDbError | null;
  count: number | null;
}

type ChainMethod = jest.MockedFunction<(...args: unknown[]) => MockChain>;

interface MockChain extends PromiseLike<MockDbResult> {
  from: ChainMethod;
  select: ChainMethod;
  insert: ChainMethod;
  update: ChainMethod;
  delete: ChainMethod;
  eq: ChainMethod;
  neq: ChainMethod;
  in: ChainMethod;
  order: ChainMethod;
  range: ChainMethod;
  limit: ChainMethod;
  single: ChainMethod;
  maybeSingle: ChainMethod;
}

interface MockSupabase {
  from: ChainMethod;
  rpc: jest.MockedFunction<(...args: unknown[]) => unknown>;
  _on: (data: unknown, error?: MockDbError | null, count?: number) => MockChain;
}

interface MockContextService {
  extractEntities: jest.MockedFunction<(text: string) => string[]>;
  getSnippetsFor: jest.MockedFunction<
    (text: string, limit?: number) => Promise<PlaceSnippet[]>
  >;
}

interface MockRateLimitService {
  checkAndIncrement: jest.MockedFunction<(userId: string) => Promise<number>>;
  limit: number;
}

interface InsertedAssistantRow {
  role?: unknown;
  metadata?: unknown;
}

function createChain(result: MockDbResult): MockChain {
  const chain = {} as MockChain;
  const methods = [
    'from',
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'in',
    'order',
    'range',
    'limit',
    'single',
    'maybeSingle',
  ] satisfies Array<keyof Omit<MockChain, 'then'>>;

  for (const method of methods) {
    chain[method] = jest
      .fn<(...args: unknown[]) => MockChain>()
      .mockReturnValue(chain);
  }

  const promise = Promise.resolve(result);
  chain.then = <TResult1 = MockDbResult, TResult2 = never>(
    onfulfilled?:
      | ((value: MockDbResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> => promise.then(onfulfilled, onrejected);
  return chain;
}

function createMockSupabase(): MockSupabase {
  const mock: MockSupabase = {
    from: jest.fn<(...args: unknown[]) => MockChain>(),
    rpc: jest.fn<(...args: unknown[]) => unknown>(),
    _on: (data: unknown, error?: MockDbError | null, count?: number) => {
      const c = createChain({
        data,
        error: error ?? null,
        count: count ?? null,
      });
      mock.from.mockReturnValueOnce(c);
      return c;
    },
  };
  mock.from.mockImplementation(() =>
    createChain({ data: null, error: null, count: null }),
  );
  return mock;
}

function firstArg<T>(method: ChainMethod): T {
  return method.mock.calls[0]?.[0] as T;
}

// ── Trackable fake provider ─────────────────────────────────────────────────
class FakeProvider implements ChatProvider {
  calls: { messages: ChatProviderMessage[]; snippets: PlaceSnippet[] }[] = [];
  reply = 'respuesta canned del fake provider';

  generate(
    messages: ChatProviderMessage[],
    snippets: PlaceSnippet[],
  ): Promise<string> {
    this.calls.push({ messages, snippets });
    return Promise.resolve(this.reply);
  }
}

describe('ChatService', () => {
  let service: ChatService;
  let supabase: MockSupabase;
  let provider: FakeProvider;
  let context: MockContextService;
  let rateLimit: MockRateLimitService;

  const USER_ID = 'user-1';
  const CONV_ID = 'conv-1';

  beforeEach(async () => {
    supabase = createMockSupabase();
    provider = new FakeProvider();

    context = {
      extractEntities: jest.fn().mockReturnValue([]),
      getSnippetsFor: jest.fn().mockResolvedValue([]),
    };

    rateLimit = {
      checkAndIncrement: jest.fn().mockResolvedValue(1),
      limit: 30,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: supabase as unknown as SupabaseClient,
        },
        { provide: CHAT_PROVIDER, useValue: provider },
        {
          provide: ContextService,
          useValue: context as unknown as ContextService,
        },
        {
          provide: ChatRateLimitService,
          useValue: rateLimit as unknown as ChatRateLimitService,
        },
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
        {
          id: 'c1',
          user_id: USER_ID,
          title: 'A',
          created_at: 'x',
          updated_at: 'y',
        },
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
        {
          id: 'm1',
          conversation_id: CONV_ID,
          role: 'user',
          content: 'hola',
          metadata: null,
          created_at: 't1',
        },
        {
          id: 'm2',
          conversation_id: CONV_ID,
          role: 'assistant',
          content: 'hi',
          metadata: null,
          created_at: 't2',
        },
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
      supabase._on({
        id: CONV_ID,
        user_id: 'OTRO',
        title: null,
        created_at: 'a',
        updated_at: 'b',
      });
      await expect(service.getConversation(USER_ID, CONV_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // sendMessage
  // ────────────────────────────────────────────────────────────────────────
  describe('sendMessage', () => {
    function mockHappyPath(
      opts: {
        recentMessages?: unknown[];
        snippets?: PlaceSnippet[];
        assistantMessage?: unknown;
      } = {},
    ) {
      // a) fetchOwnedConversation
      supabase._on({
        id: CONV_ID,
        user_id: USER_ID,
        title: null,
        created_at: 'a',
        updated_at: 'b',
      });
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
        {
          id: 'm-user',
          conversation_id: CONV_ID,
          role: 'user',
          content: 'hola',
          metadata: null,
          created_at: 'now',
        },
      ];
      supabase._on(recent);
      // d) insert assistant message
      supabase._on(
        opts.assistantMessage ?? {
          id: 'm-assistant',
          conversation_id: CONV_ID,
          role: 'assistant',
          content: provider.reply,
          metadata:
            opts.snippets && opts.snippets.length
              ? { context_place_ids: opts.snippets.map((s) => s.id) }
              : null,
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
      const fromCalls = supabase.from.mock.calls.map(([table]) => table);
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
      supabase._on({
        id: CONV_ID,
        user_id: USER_ID,
        title: null,
        created_at: 'a',
        updated_at: 'b',
      });
      rateLimit.checkAndIncrement.mockRejectedValueOnce(
        new ForbiddenException('limit excedido'),
      );
      await expect(
        service.sendMessage(USER_ID, CONV_ID, 'hola'),
      ).rejects.toThrow(ForbiddenException);
      // provider no debe haberse llamado
      expect(provider.calls).toHaveLength(0);
    });

    it('rechaza con 404 si la conversation no existe', async () => {
      supabase._on(null);
      await expect(
        service.sendMessage(USER_ID, CONV_ID, 'hola'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza con 403 si la conversation es de otro user', async () => {
      supabase._on({
        id: CONV_ID,
        user_id: 'OTRO',
        title: null,
        created_at: 'a',
        updated_at: 'b',
      });
      await expect(
        service.sendMessage(USER_ID, CONV_ID, 'hola'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza con BadRequest si el content esta vacio', async () => {
      await expect(
        service.sendMessage(USER_ID, CONV_ID, '   '),
      ).rejects.toThrow(BadRequestException);
    });

    it('incluye context snippets cuando el mensaje matchea keyword', async () => {
      const snippets: PlaceSnippet[] = [
        { id: 'place-1', name: 'Playa Salgar', average_rating: 4.5 },
        { id: 'place-2', name: 'Playa Pradomar', average_rating: 4.2 },
      ];
      mockHappyPath({ snippets });

      const result = await service.sendMessage(
        USER_ID,
        CONV_ID,
        'quiero ir a la playa',
      );

      expect(provider.calls[0].snippets).toEqual(snippets);
      // metadata del assistant message persistido (chequeable via insertCall args)
      const chatMessageChains: MockChain[] = [];
      supabase.from.mock.results.forEach((result, index) => {
        if (
          result.type === 'return' &&
          supabase.from.mock.calls[index]?.[0] === 'chat_messages'
        ) {
          chatMessageChains.push(result.value);
        }
      });
      // hay 3 calls a chat_messages: insert user, select recent, insert assistant
      const assistantInsertChain = chatMessageChains[2];
      if (assistantInsertChain === undefined) {
        throw new Error('Expected assistant insert chain');
      }
      expect(assistantInsertChain.insert).toHaveBeenCalled();
      const insertedRow = firstArg<InsertedAssistantRow>(
        assistantInsertChain.insert,
      );
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
      supabase._on({
        id: CONV_ID,
        user_id: USER_ID,
        title: null,
        created_at: 'a',
        updated_at: 'b',
      });
      supabase._on(null);
      await expect(
        service.deleteConversation(USER_ID, CONV_ID),
      ).resolves.toBeUndefined();
    });

    it('tira 403 si no es del user', async () => {
      supabase._on({
        id: CONV_ID,
        user_id: 'OTRO',
        title: null,
        created_at: 'a',
        updated_at: 'b',
      });
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
