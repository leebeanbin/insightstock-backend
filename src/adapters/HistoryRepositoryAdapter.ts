import { IHistoryRepository } from '../repositories/IHistoryRepository';
import { History } from '../entities/History';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { DatabaseError } from '../errors/AppError';
import { Prisma } from '@prisma/client';

export class HistoryRepositoryAdapter implements IHistoryRepository {
  /**
   * 트랜잭션 클라이언트를 선택적으로 받을 수 있도록 확장
   * 트랜잭션이 없으면 기본 prisma 클라이언트 사용
   */
  constructor(private readonly tx?: Prisma.TransactionClient) {}

  /**
   * 트랜잭션 클라이언트를 사용하는 새로운 인스턴스 생성
   * 트랜잭션 내에서 Repository를 사용할 때 호출
   */
  static withTransaction(tx: Prisma.TransactionClient): HistoryRepositoryAdapter {
    return new HistoryRepositoryAdapter(tx);
  }

  private get client() {
    return this.tx || prisma;
  }

  async findAll(userId: string, limit: number = 20, offset: number = 0): Promise<{
    data: History[];
    total: number;
  }> {
    try {
      const where = { userId };
      const [histories, total] = await Promise.all([
        this.client.history.findMany({
          where,
          include: { stock: true },
          orderBy: { viewedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.client.history.count({ where }),
      ]);

      const data = histories.map(
        (h) =>
          new History(
            h.id,
            h.userId,
            h.stockId,
            h.type,
            h.viewedAt
          )
      );

      return { data, total };
    } catch (error) {
      logger.error('HistoryRepositoryAdapter.findAll error:', error);
      throw new DatabaseError('Failed to fetch history from database');
    }
  }

  async findById(id: string, userId: string): Promise<History | null> {
    try {
      const history = await this.client.history.findFirst({
        where: { id, userId },
        include: { stock: true },
      });

      if (!history) return null;

      return new History(
        history.id,
        history.userId,
        history.stockId,
        history.type,
        history.viewedAt
      );
    } catch (error) {
      logger.error('HistoryRepositoryAdapter.findById error:', error);
      throw new DatabaseError('Failed to fetch history from database');
    }
  }

  async findByUserAndStock(
    userId: string,
    stockId: string,
    hours: number = 1
  ): Promise<History | null> {
    try {
      const history = await this.client.history.findFirst({
        where: {
          userId,
          stockId,
          viewedAt: {
            gte: new Date(Date.now() - hours * 60 * 60 * 1000),
          },
        },
        include: { stock: true },
      });

      if (!history) return null;

      return new History(
        history.id,
        history.userId,
        history.stockId,
        history.type,
        history.viewedAt
      );
    } catch (error) {
      logger.error('HistoryRepositoryAdapter.findByUserAndStock error:', error);
      throw new DatabaseError('Failed to fetch history from database');
    }
  }

  async create(history: History): Promise<History> {
    try {
      const created = await this.client.history.create({
        data: {
          userId: history.userId,
          stockId: history.stockId,
          type: history.type,
        },
        include: { stock: true },
      });

      return new History(
        created.id,
        created.userId,
        created.stockId,
        created.type,
        created.viewedAt
      );
    } catch (error) {
      logger.error('HistoryRepositoryAdapter.create error:', error);
      throw new DatabaseError('Failed to create history in database');
    }
  }

  async deleteAll(userId: string): Promise<void> {
    try {
      await this.client.history.deleteMany({
        where: { userId },
      });
    } catch (error) {
      logger.error('HistoryRepositoryAdapter.deleteAll error:', error);
      throw new DatabaseError('Failed to delete history from database');
    }
  }
}

