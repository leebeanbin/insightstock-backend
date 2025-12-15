import { FastifyPluginAsync } from 'fastify';
import { ChatController } from '../controllers/ChatController';
import { ChatService } from '../services/ChatService';
import { ConversationRepositoryAdapter } from '../adapters/ConversationRepositoryAdapter';
import { MessageRepositoryAdapter } from '../adapters/MessageRepositoryAdapter';
import { MessageFeedbackController } from '../controllers/MessageFeedbackController';
import { MessageFeedbackService } from '../services/MessageFeedbackService';
import { MessageFeedbackRepositoryAdapter } from '../adapters/MessageFeedbackRepositoryAdapter';
import { authenticate } from '../middlewares/auth';

// Dependency Injection
const conversationRepository = new ConversationRepositoryAdapter();
const messageRepository = new MessageRepositoryAdapter();
const chatFacade = new ChatService(conversationRepository, messageRepository);
const chatController = new ChatController(chatFacade);

const feedbackRepository = new MessageFeedbackRepositoryAdapter();
const feedbackService = new MessageFeedbackService(feedbackRepository);
const feedbackController = new MessageFeedbackController(feedbackService);

const routes: FastifyPluginAsync = async (fastify) => {
  // Auth hook for all routes
  fastify.addHook('onRequest', async (request, reply) => {
    await authenticate(request, reply);
  });

  // 대화 목록 조회
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

  // SSE 스트리밍 (Server-Sent Events)
  fastify.get('/stream', async (request, reply) => {
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

