import { FastifyRequest, FastifyReply } from 'fastify';
import { IChatFacade } from '../facades/IChatFacade';
import { CreateChatDto } from '../dto/chat/CreateChatDto';

export class ChatController {
  constructor(private readonly chatFacade: IChatFacade) {}

  async getConversations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const { search, category } = request.query as { search?: string; category?: string };
    const conversations = await this.chatFacade.getConversations(userId, search, category);

    reply.send({
      success: true,
      data: conversations,
    });
  }

  async createConversation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const { title } = request.body as { title: string };

    // ✅ 실제 DB에 저장: ChatService를 통해 UUID 형식 ID 생성
    const conversation = await this.chatFacade.createConversation(
      userId,
      title || 'New Conversation'
    );

    reply.status(201).send({
      success: true,
      data: conversation,
    });
  }

  async getMessages(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { conversationId } = request.params as { conversationId: string };
    const userId = request.userId!;

    const messages = await this.chatFacade.getMessages(conversationId, userId);

    reply.send({
      success: true,
      data: messages,
    });
  }

  async streamChat(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;

    // GET 쿼리 파라미터 또는 POST body에서 데이터 가져오기
    let dto: CreateChatDto;
    if (request.method === 'GET') {
      dto = CreateChatDto.fromQuery(request.query as Record<string, string | undefined>);
    } else {
      dto = CreateChatDto.from(request.body);
    }

    // Set SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*'); // CORS for SSE

    try {
      const stream = this.chatFacade.streamChat(userId, dto);
      let conversationId = dto.conversationId || '';
      let messageId = '';

      for await (const chunk of stream) {
        // 첫 청크에서 conversationId와 messageId가 포함될 수 있음
        if (typeof chunk === 'object' && chunk !== null) {
          conversationId = (chunk as any).conversationId || conversationId;
          messageId = (chunk as any).messageId || messageId;
          const content = (chunk as any).content || '';
          reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
        } else {
          reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }
      }

      reply.raw.write(`data: ${JSON.stringify({
        type: 'done',
        conversationId,
        messageId: messageId || `msg_${Date.now()}`
      })}\n\n`);
      reply.raw.end();
    } catch (error) {
      logger.error('ChatController.streamChat error:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to generate chat response';
      
      reply.raw.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: errorMessage
        })}\n\n`
      );
      reply.raw.end();
    }
  }

  async deleteConversation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const userId = request.userId!;

    await this.chatFacade.deleteConversation(id, userId);

    reply.send({
      success: true,
      message: 'Conversation deleted successfully',
    });
  }

  async getSuggestedQuestions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const questions = await this.chatFacade.getSuggestedQuestions(userId);

    reply.send({
      success: true,
      data: questions,
    });
  }

  async getContextConsentStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const enabled = await this.chatFacade.getContextConsentStatus(userId);

    reply.send({
      success: true,
      data: { enabled },
    });
  }

  async setContextConsent(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const { enabled } = request.body as { enabled: boolean };

    await this.chatFacade.setContextConsent(userId, enabled);

    reply.send({
      success: true,
      message: `Context consent ${enabled ? 'enabled' : 'disabled'}`,
    });
  }

  async regenerateMessage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { messageId } = request.params as { messageId: string };
    const userId = request.userId!;

    // Set SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');

    try {
      const stream = this.chatFacade.regenerateMessage(userId, messageId);

      for await (const chunk of stream) {
        reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }

      reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      reply.raw.end();
    } catch (error) {
      reply.raw.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Failed to regenerate message'
        })}\n\n`
      );
      reply.raw.end();
    }
  }
}

