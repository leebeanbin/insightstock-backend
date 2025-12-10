import { IMessageFeedbackRepository } from '../repositories/IMessageFeedbackRepository';
import { MessageFeedback } from '../entities/MessageFeedback';
import { CreateMessageFeedbackDto } from '../dto/message/CreateMessageFeedbackDto';
import { NotFoundError } from '../errors/AppError';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';

export class MessageFeedbackService {
  constructor(private readonly feedbackRepository: IMessageFeedbackRepository) {}

  async toggleFeedback(
    userId: string,
    messageId: string,
    dto: CreateMessageFeedbackDto
  ): Promise<{ feedback: MessageFeedback; counts: { likes: number; dislikes: number } }> {
    // 메시지 존재 확인
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundError('Message');
    }

    // 기존 피드백 확인
    const existing = await this.feedbackRepository.findByMessageAndUser(messageId, userId);

    if (existing) {
      // 같은 타입이면 삭제, 다른 타입이면 업데이트
      if (existing.type === dto.type) {
        await this.feedbackRepository.delete(existing.id);
        logger.info(`Message feedback removed: ${existing.id} for message ${messageId}`);
      } else {
        const updated = await this.feedbackRepository.update(existing.id, dto.type);
        logger.info(`Message feedback updated: ${updated.id} for message ${messageId}`);
        const counts = await this.feedbackRepository.countByMessage(messageId);
        return { feedback: updated, counts };
      }
    } else {
      // 새 피드백 생성
      const feedback = new MessageFeedback('', messageId, userId, dto.type);
      const created = await this.feedbackRepository.create(feedback);
      logger.info(`Message feedback created: ${created.id} for message ${messageId}`);
      const counts = await this.feedbackRepository.countByMessage(messageId);
      return { feedback: created, counts };
    }

    // 삭제된 경우 카운트 반환
    const counts = await this.feedbackRepository.countByMessage(messageId);
    return {
      feedback: existing,
      counts,
    };
  }

  async getFeedbackCounts(messageId: string): Promise<{ likes: number; dislikes: number }> {
    return await this.feedbackRepository.countByMessage(messageId);
  }

  async getUserFeedback(userId: string, messageId: string): Promise<MessageFeedback | null> {
    return await this.feedbackRepository.findByMessageAndUser(messageId, userId);
  }
}

