import { IMessageRepository } from '../repositories/IMessageRepository';
import { Message } from '../entities/Message';
import { prisma } from '../config/prisma';
import { DatabaseError } from "../errors/AppError";
import { logger } from '../config/logger';

export class MessageRepositoryAdapter implements IMessageRepository {
  async findAll(conversationId: string): Promise<Message[]> {
    try {
      // 페이징 없이 전체 조회 (기존 동작 유지)
      // TODO: 대화가 길어질 경우 페이징 구현 필요
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        // 성능 최적화: 필요한 필드만 선택
        select: {
          id: true,
          conversationId: true,
          userId: true,
          role: true,
          content: true,
          sources: true,
          createdAt: true,
        },
      });

      return messages.map(
        (m) =>
          new Message(
            m.id,
            m.conversationId,
            m.userId,
            m.role as 'user' | 'assistant',
            m.content,
            m.sources,
            m.createdAt
          )
      );
    } catch (error) {
      logger.error('MessageRepositoryAdapter.findAll error:', error);
      throw new DatabaseError('Failed to fetch messages from database');
    }
  }

  /**
   * 페이징을 지원하는 메시지 조회 (대규모 대화 처리용)
   */
  async findMany(
    conversationId: string,
    limit: number = 50,
    cursor?: string
  ): Promise<{ messages: Message[]; nextCursor?: string }> {
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId },
        take: limit + 1, // 다음 페이지 확인용
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          conversationId: true,
          userId: true,
          role: true,
          content: true,
          sources: true,
          createdAt: true,
        },
      });

      const hasNext = messages.length > limit;
      const result = hasNext ? messages.slice(0, limit) : messages;

      return {
        messages: result
          .reverse()
          .map(
            (m) =>
              new Message(
                m.id,
                m.conversationId,
                m.userId,
                m.role as 'user' | 'assistant',
                m.content,
                m.sources,
                m.createdAt
              )
          ),
        nextCursor: hasNext ? result[result.length - 1].id : undefined,
      };
    } catch (error) {
      logger.error('MessageRepositoryAdapter.findMany error:', error);
      throw new DatabaseError('Failed to fetch messages from database');
    }
  }

  async findById(id: string): Promise<Message | null> {
    try {
      const message = await prisma.message.findUnique({
        where: { id },
      });

      if (!message) return null;

      return new Message(
        message.id,
        message.conversationId,
        message.userId,
        message.role as 'user' | 'assistant',
        message.content,
        message.sources,
        message.createdAt
      );
    } catch (error) {
      logger.error('MessageRepositoryAdapter.findById error:', error);
      throw new DatabaseError('Failed to fetch message from database');
    }
  }

  async create(message: Message): Promise<Message> {
    try {
      const created = await prisma.message.create({
        data: {
          conversationId: message.conversationId,
          userId: message.userId,
          role: message.role,
          content: message.content,
          sources: message.sources,
        },
      });

      return new Message(
        created.id,
        created.conversationId,
        created.userId,
        created.role as 'user' | 'assistant',
        created.content,
        created.sources,
        created.createdAt
      );
    } catch (error) {
      logger.error('MessageRepositoryAdapter.create error:', error);
      throw new DatabaseError('Failed to create message in database');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.message.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('MessageRepositoryAdapter.delete error:', error);
      throw new DatabaseError('Failed to delete message from database');
    }
  }
}

