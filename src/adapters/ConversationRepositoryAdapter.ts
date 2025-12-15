import { IConversationRepository } from '../repositories/IConversationRepository';
import { Conversation } from '../entities/Conversation';
import { prisma } from '../config/prisma';
import { DatabaseError } from "../errors/AppError";
import { logger } from '../config/logger';

export class ConversationRepositoryAdapter implements IConversationRepository {
  async findAll(userId: string, search?: string, category?: string): Promise<Conversation[]> {
    try {
      const where: any = { userId };
      
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } },
        ];
      }
      
      if (category) {
        where.category = category;
      }

      const conversations = await prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
      });

      return conversations.map(
        (c) =>
          new Conversation(
            c.id,
            c.userId,
            c.title,
            c.category || undefined,
            c.tags || [],
            c.createdAt,
            c.updatedAt,
            c.lastMessage || undefined,
            c.lastMessageAt || undefined
          )
      );
    } catch (error) {
      logger.error('ConversationRepositoryAdapter.findAll error:', error);
      throw new DatabaseError('Failed to fetch conversations from database');
    }
  }

  async findById(id: string, userId: string): Promise<Conversation | null> {
    try {
      const conversation = await prisma.conversation.findFirst({
        where: { id, userId },
      });

      if (!conversation) return null;

      return new Conversation(
        conversation.id,
        conversation.userId,
        conversation.title,
        conversation.category || undefined,
        conversation.tags || [],
        conversation.createdAt,
        conversation.updatedAt,
        conversation.lastMessage || undefined,
        conversation.lastMessageAt || undefined
      );
    } catch (error) {
      logger.error('ConversationRepositoryAdapter.findById error:', error);
      throw new DatabaseError('Failed to fetch conversation from database');
    }
  }

  async create(conversation: Conversation): Promise<Conversation> {
    try {
      const created = await prisma.conversation.create({
        data: {
          userId: conversation.userId,
          title: conversation.title,
          category: conversation.category,
          tags: conversation.tags || [],
        },
      });

      return new Conversation(
        created.id,
        created.userId,
        created.title,
        created.category || undefined,
        created.tags || [],
        created.createdAt,
        created.updatedAt,
        created.lastMessage || undefined,
        created.lastMessageAt || undefined
      );
    } catch (error) {
      logger.error('ConversationRepositoryAdapter.create error:', error);
      throw new DatabaseError('Failed to create conversation in database');
    }
  }

  async update(id: string, conversation: Partial<Conversation>): Promise<Conversation> {
    try {
      const updated = await prisma.conversation.update({
        where: { id },
        data: {
          ...(conversation.title && { title: conversation.title }),
          ...(conversation.category !== undefined && { category: conversation.category }),
          ...(conversation.tags !== undefined && { tags: conversation.tags }),
          ...(conversation.lastMessage !== undefined && { lastMessage: conversation.lastMessage }),
          ...(conversation.lastMessageAt !== undefined && { lastMessageAt: conversation.lastMessageAt }),
          ...(conversation.updatedAt !== undefined && { updatedAt: conversation.updatedAt }),
        },
      });

      return new Conversation(
        updated.id,
        updated.userId,
        updated.title,
        updated.category || undefined,
        updated.tags || [],
        updated.createdAt,
        updated.updatedAt,
        updated.lastMessage || undefined,
        updated.lastMessageAt || undefined
      );
    } catch (error) {
      logger.error('ConversationRepositoryAdapter.update error:', error);
      throw new DatabaseError('Failed to update conversation in database');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.conversation.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('ConversationRepositoryAdapter.delete error:', error);
      throw new DatabaseError('Failed to delete conversation from database');
    }
  }
}

