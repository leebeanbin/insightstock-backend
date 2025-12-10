import { FastifyPluginAsync } from 'fastify';
import { ChatController } from '../controllers/ChatController';
import { ChatService } from '../services/ChatService';
import { ConversationRepositoryAdapter } from '../adapters/ConversationRepositoryAdapter';
import { MessageRepositoryAdapter } from '../adapters/MessageRepositoryAdapter';
import { MessageFeedbackController } from '../controllers/MessageFeedbackController';
import { MessageFeedbackService } from '../services/MessageFeedbackService';
import { MessageFeedbackRepositoryAdapter } from '../adapters/MessageFeedbackRepositoryAdapter';
import { authenticate } from '../middlewares/auth';
import { WebSocketService } from '../services/WebSocketService';
import { authenticateWebSocket } from '../middlewares/websocketAuth';
import { logger } from '../config/logger';

// Dependency Injection
const conversationRepository = new ConversationRepositoryAdapter();
const messageRepository = new MessageRepositoryAdapter();
const chatFacade = new ChatService(conversationRepository, messageRepository);
const chatController = new ChatController(chatFacade);
const webSocketService = new WebSocketService(chatFacade);

const feedbackRepository = new MessageFeedbackRepositoryAdapter();
const feedbackService = new MessageFeedbackService(feedbackRepository);
const feedbackController = new MessageFeedbackController(feedbackService);

const routes: FastifyPluginAsync = async (fastify) => {
  // Auth hook for all routes (WebSocket 제외)
  fastify.addHook('onRequest', async (request, reply) => {
    // WebSocket 업그레이드 요청은 별도 처리
    if (request.headers.upgrade === 'websocket') {
      return;
    }
    await authenticate(request, reply);
  });

  // WebSocket 엔드포인트
  // @ts-ignore - @fastify/websocket 타입 정의 문제로 인한 임시 처리
  fastify.get('/ws', { websocket: true }, async (connection: any, request: any) => {
    try {
      // WebSocket 연결 인증
      const userId = authenticateWebSocket(request);
      await webSocketService.handleConnection(connection.socket, userId);
    } catch (error) {
      logger.error('WebSocket connection error:', error);
      if (connection.socket && typeof connection.socket.close === 'function') {
        connection.socket.close(1008, 'Unauthorized');
      }
    }
  });

  // 대화 목록 조회 (기본 엔드포인트)
  fastify.get('/', async (request, reply) => {
    await chatController.getConversations(request, reply);
  });

  fastify.get('/conversations', async (request, reply) => {
    await chatController.getConversations(request, reply);
  });

  // 대화 생성
  fastify.post('/conversations', async (request, reply) => {
    await chatController.createConversation(request, reply);
  });

  fastify.get('/conversations/:conversationId/messages', async (request, reply) => {
    await chatController.getMessages(request, reply);
  });

  // SSE 스트리밍 - 하위 호환성을 위해 유지 (GET과 POST 모두 지원)
  fastify.get('/stream', async (request, reply) => {
    await chatController.streamChat(request, reply);
  });

  fastify.post('/stream', async (request, reply) => {
    await chatController.streamChat(request, reply);
  });

  fastify.delete('/conversations/:id', async (request, reply) => {
    await chatController.deleteConversation(request, reply);
  });

  fastify.get('/suggested-questions', async (request, reply) => {
    await chatController.getSuggestedQuestions(request, reply);
  });

  fastify.get('/context-consent', async (request, reply) => {
    await chatController.getContextConsentStatus(request, reply);
  });

  fastify.post('/context-consent', async (request, reply) => {
    await chatController.setContextConsent(request, reply);
  });

  // Message Feedback APIs
  fastify.post('/messages/:messageId/feedback', async (request, reply) => {
    await feedbackController.toggleFeedback(request, reply);
  });

  fastify.get('/messages/:messageId/feedback', async (request, reply) => {
    await feedbackController.getFeedbackCounts(request, reply);
  });

  fastify.get('/messages/:messageId/feedback/user', async (request, reply) => {
    await feedbackController.getUserFeedback(request, reply);
  });

  // Message Regeneration API
  fastify.post('/messages/:messageId/regenerate', async (request, reply) => {
    await chatController.regenerateMessage(request, reply);
  });
};

export default routes;

