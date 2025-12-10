import { FastifyRequest, FastifyReply } from 'fastify';
import { MessageFeedbackService } from '../services/MessageFeedbackService';
import { CreateMessageFeedbackDto } from '../dto/message/CreateMessageFeedbackDto';

export class MessageFeedbackController {
  constructor(private readonly feedbackService: MessageFeedbackService) {}

  async toggleFeedback(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { messageId } = request.params as { messageId: string };
    const userId = request.userId!;
    const dto = CreateMessageFeedbackDto.from(request.body);

    const result = await this.feedbackService.toggleFeedback(userId, messageId, dto);

    reply.send({
      success: true,
      data: {
        feedback: {
          id: result.feedback.id,
          type: result.feedback.type,
          messageId: result.feedback.messageId,
        },
        counts: result.counts,
      },
    });
  }

  async getFeedbackCounts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { messageId } = request.params as { messageId: string };

    const counts = await this.feedbackService.getFeedbackCounts(messageId);

    reply.send({
      success: true,
      data: counts,
    });
  }

  async getUserFeedback(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { messageId } = request.params as { messageId: string };
    const userId = request.userId!;

    const feedback = await this.feedbackService.getUserFeedback(userId, messageId);

    reply.send({
      success: true,
      data: feedback
        ? {
            id: feedback.id,
            type: feedback.type,
            messageId: feedback.messageId,
          }
        : null,
    });
  }
}

