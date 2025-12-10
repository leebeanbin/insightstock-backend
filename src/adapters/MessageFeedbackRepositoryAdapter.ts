import { IMessageFeedbackRepository } from '../repositories/IMessageFeedbackRepository';
import { MessageFeedback } from '../entities/MessageFeedback';
import { prisma } from '../config/prisma';
import { DatabaseError } from '../errors/AppError';
import { logger } from '../config/logger';

export class MessageFeedbackRepositoryAdapter implements IMessageFeedbackRepository {
  async findByMessageAndUser(messageId: string, userId: string): Promise<MessageFeedback | null> {
    try {
      const feedback = await prisma.messageFeedback.findUnique({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
      });

      if (!feedback) return null;

      return new MessageFeedback(
        feedback.id,
        feedback.messageId,
        feedback.userId,
        feedback.type as 'like' | 'dislike',
        feedback.createdAt
      );
    } catch (error) {
      logger.error('MessageFeedbackRepositoryAdapter.findByMessageAndUser error:', error);
      throw new DatabaseError('Failed to fetch message feedback from database');
    }
  }

  async create(feedback: MessageFeedback): Promise<MessageFeedback> {
    try {
      const created = await prisma.messageFeedback.create({
        data: {
          messageId: feedback.messageId,
          userId: feedback.userId,
          type: feedback.type,
        },
      });

      return new MessageFeedback(
        created.id,
        created.messageId,
        created.userId,
        created.type as 'like' | 'dislike',
        created.createdAt
      );
    } catch (error) {
      logger.error('MessageFeedbackRepositoryAdapter.create error:', error);
      throw new DatabaseError('Failed to create message feedback in database');
    }
  }

  async update(id: string, type: 'like' | 'dislike'): Promise<MessageFeedback> {
    try {
      const updated = await prisma.messageFeedback.update({
        where: { id },
        data: { type },
      });

      return new MessageFeedback(
        updated.id,
        updated.messageId,
        updated.userId,
        updated.type as 'like' | 'dislike',
        updated.createdAt
      );
    } catch (error) {
      logger.error('MessageFeedbackRepositoryAdapter.update error:', error);
      throw new DatabaseError('Failed to update message feedback in database');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.messageFeedback.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('MessageFeedbackRepositoryAdapter.delete error:', error);
      throw new DatabaseError('Failed to delete message feedback from database');
    }
  }

  async countByMessage(messageId: string): Promise<{ likes: number; dislikes: number }> {
    try {
      const [likes, dislikes] = await Promise.all([
        prisma.messageFeedback.count({
          where: { messageId, type: 'like' },
        }),
        prisma.messageFeedback.count({
          where: { messageId, type: 'dislike' },
        }),
      ]);

      return { likes, dislikes };
    } catch (error) {
      logger.error('MessageFeedbackRepositoryAdapter.countByMessage error:', error);
      throw new DatabaseError('Failed to count message feedback from database');
    }
  }
}

