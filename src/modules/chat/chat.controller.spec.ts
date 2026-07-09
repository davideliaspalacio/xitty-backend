import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Response as SupertestResponse } from 'superagent';
import type { App as SupertestApp } from 'supertest/types';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import type {
  ConversationResponseDto,
  ConversationWithMessagesDto,
  CreateConversationResponseDto,
  MessageResponseDto,
} from './dto/message-response.dto';

type ChatServiceMock = {
  listConversations: jest.MockedFunction<ChatService['listConversations']>;
  createConversation: jest.MockedFunction<ChatService['createConversation']>;
  getConversation: jest.MockedFunction<ChatService['getConversation']>;
  sendMessage: jest.MockedFunction<ChatService['sendMessage']>;
  deleteConversation: jest.MockedFunction<ChatService['deleteConversation']>;
};

interface ErrorResponseBody {
  message: string;
}

function bodyAs<T>(res: SupertestResponse): T {
  return res.body as T;
}

describe('ChatController (supertest)', () => {
  let app: INestApplication;
  let chatService: ChatServiceMock;

  const JWT_SECRET = 'test-secret-chat-controller';
  const USER_ID = '11111111-1111-1111-1111-111111111111';
  const CONV_UUID = '22222222-2222-2222-2222-222222222222';

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  beforeEach(async () => {
    chatService = {
      listConversations: jest.fn<ChatService['listConversations']>(),
      createConversation: jest.fn<ChatService['createConversation']>(),
      getConversation: jest.fn<ChatService['getConversation']>(),
      sendMessage: jest.fn<ChatService['sendMessage']>(),
      deleteConversation: jest.fn<ChatService['deleteConversation']>(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: chatService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function httpServer(): SupertestApp {
    return app.getHttpServer() as SupertestApp;
  }

  function bearer(role: string = 'user', sub: string = USER_ID): string {
    const token = jwt.sign(
      { sub, role, email: 'a@b.co', type: 'access' },
      JWT_SECRET,
      { expiresIn: '1h' },
    );
    return `Bearer ${token}`;
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  describe('auth', () => {
    it('POST /chat/conversations/:id/messages requiere auth (401 sin token)', async () => {
      await request(httpServer())
        .post(`/chat/conversations/${CONV_UUID}/messages`)
        .send({ content: 'hola' })
        .expect(401);
    });

    it('GET /chat/conversations requiere auth', async () => {
      await request(httpServer()).get('/chat/conversations').expect(401);
    });

    it('POST /chat/conversations requiere auth', async () => {
      await request(httpServer())
        .post('/chat/conversations')
        .send({})
        .expect(401);
    });
  });

  // ── POST /chat/conversations ────────────────────────────────────────────
  describe('POST /chat/conversations', () => {
    it('crea una conversacion y retorna 201 + id', async () => {
      chatService.createConversation.mockResolvedValueOnce({
        conversation_id: CONV_UUID,
        first_message_id: null,
      });

      const res = await request(httpServer())
        .post('/chat/conversations')
        .set('Authorization', bearer())
        .send({ title: 'Tour Centro' })
        .expect(201);

      const body = bodyAs<CreateConversationResponseDto>(res);
      expect(body.conversation_id).toBe(CONV_UUID);
      expect(chatService.createConversation.mock.calls).toEqual([
        [USER_ID, { title: 'Tour Centro' }],
      ]);
    });

    it('valida title muy largo (400)', async () => {
      const longTitle = 'x'.repeat(201);
      await request(httpServer())
        .post('/chat/conversations')
        .set('Authorization', bearer())
        .send({ title: longTitle })
        .expect(400);
    });

    it('pasa el first_message al service', async () => {
      chatService.createConversation.mockResolvedValueOnce({
        conversation_id: CONV_UUID,
        first_message_id: 'msg-1',
      });

      await request(httpServer())
        .post('/chat/conversations')
        .set('Authorization', bearer())
        .send({ first_message: 'hola' })
        .expect(201);

      expect(chatService.createConversation.mock.calls).toEqual([
        [USER_ID, { first_message: 'hola' }],
      ]);
    });
  });

  // ── GET /chat/conversations ─────────────────────────────────────────────
  describe('GET /chat/conversations', () => {
    it('retorna la lista', async () => {
      chatService.listConversations.mockResolvedValueOnce([
        {
          id: CONV_UUID,
          user_id: USER_ID,
          title: 'A',
          created_at: 'x',
          updated_at: 'y',
        },
      ]);
      const res = await request(httpServer())
        .get('/chat/conversations')
        .set('Authorization', bearer())
        .expect(200);
      const body = bodyAs<ConversationResponseDto[]>(res);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(CONV_UUID);
    });
  });

  // ── GET /chat/conversations/:id ─────────────────────────────────────────
  describe('GET /chat/conversations/:id', () => {
    it('retorna la conversation con messages', async () => {
      chatService.getConversation.mockResolvedValueOnce({
        id: CONV_UUID,
        user_id: USER_ID,
        title: null,
        created_at: 'a',
        updated_at: 'b',
        messages: [
          {
            id: 'm1',
            conversation_id: CONV_UUID,
            role: 'user',
            content: 'hi',
            metadata: null,
            created_at: 't',
          },
        ],
      });
      const res = await request(httpServer())
        .get(`/chat/conversations/${CONV_UUID}`)
        .set('Authorization', bearer())
        .expect(200);
      const body = bodyAs<ConversationWithMessagesDto>(res);
      expect(body.messages).toHaveLength(1);
    });

    it('rechaza ids no-uuid (400)', async () => {
      await request(httpServer())
        .get('/chat/conversations/not-a-uuid')
        .set('Authorization', bearer())
        .expect(400);
    });
  });

  // ── POST /chat/conversations/:id/messages ───────────────────────────────
  describe('POST /chat/conversations/:id/messages', () => {
    it('envia un mensaje y retorna el assistant reply (201)', async () => {
      chatService.sendMessage.mockResolvedValueOnce({
        id: 'asistente-1',
        conversation_id: CONV_UUID,
        role: 'assistant',
        content: 'hola, soy Xitty',
        metadata: null,
        created_at: 'now',
      });

      const res = await request(httpServer())
        .post(`/chat/conversations/${CONV_UUID}/messages`)
        .set('Authorization', bearer())
        .send({ content: 'hola' })
        .expect(201);

      const body = bodyAs<MessageResponseDto>(res);
      expect(body.role).toBe('assistant');
      expect(body.content).toContain('Xitty');
      expect(chatService.sendMessage.mock.calls).toEqual([
        [USER_ID, CONV_UUID, 'hola'],
      ]);
    });

    it('rate limit returns 403', async () => {
      chatService.sendMessage.mockRejectedValueOnce(
        new ForbiddenException('Limite diario alcanzado'),
      );

      const res = await request(httpServer())
        .post(`/chat/conversations/${CONV_UUID}/messages`)
        .set('Authorization', bearer())
        .send({ content: 'hola' })
        .expect(403);

      const body = bodyAs<ErrorResponseBody>(res);
      expect(body.message).toMatch(/Limite/i);
    });

    it('valida content vacio (400)', async () => {
      await request(httpServer())
        .post(`/chat/conversations/${CONV_UUID}/messages`)
        .set('Authorization', bearer())
        .send({ content: '' })
        .expect(400);
    });

    it('valida content muy largo (400)', async () => {
      const huge = 'x'.repeat(4001);
      await request(httpServer())
        .post(`/chat/conversations/${CONV_UUID}/messages`)
        .set('Authorization', bearer())
        .send({ content: huge })
        .expect(400);
    });
  });

  // ── DELETE /chat/conversations/:id ──────────────────────────────────────
  describe('DELETE /chat/conversations/:id', () => {
    it('elimina la conversation (204)', async () => {
      chatService.deleteConversation.mockResolvedValueOnce(undefined);
      await request(httpServer())
        .delete(`/chat/conversations/${CONV_UUID}`)
        .set('Authorization', bearer())
        .expect(204);
      expect(chatService.deleteConversation.mock.calls).toEqual([
        [USER_ID, CONV_UUID],
      ]);
    });
  });
});
