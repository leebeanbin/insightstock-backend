import { IPortfolioRepository } from '../repositories/IPortfolioRepository';
import { Portfolio } from '../entities/Portfolio';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { DatabaseError } from '../errors/AppError';
import { Prisma } from '@prisma/client';

export class PortfolioRepositoryAdapter implements IPortfolioRepository {
  /**
   * 트랜잭션 클라이언트를 선택적으로 받을 수 있도록 확장
   * 트랜잭션이 없으면 기본 prisma 클라이언트 사용
   */
  constructor(private readonly tx?: Prisma.TransactionClient) {}

  /**
   * 트랜잭션 클라이언트를 사용하는 새로운 인스턴스 생성
   * 트랜잭션 내에서 Repository를 사용할 때 호출
   */
  static withTransaction(tx: Prisma.TransactionClient): PortfolioRepositoryAdapter {
    return new PortfolioRepositoryAdapter(tx);
  }

  private get client() {
    return this.tx || prisma;
  }

  async findAll(userId: string): Promise<Portfolio[]> {
    try {
      const portfolios = await this.client.portfolio.findMany({
        where: { userId },
        include: { stock: true },
        orderBy: { createdAt: 'desc' },
      });

      return portfolios.map((p) =>
        new Portfolio(
          p.id,
          p.userId,
          p.stockId,
          p.quantity,
          p.averagePrice,
          p.totalCost,
          p.currentValue,
          p.profit,
          p.profitRate,
          p.createdAt,
          p.updatedAt
        ).recalculate(p.stock.currentPrice)
      );
    } catch (error) {
      logger.error('PortfolioRepositoryAdapter.findAll error:', error);
      throw new DatabaseError('Failed to fetch portfolios from database');
    }
  }

  async findById(id: string, userId: string): Promise<Portfolio | null> {
    try {
      const portfolio = await this.client.portfolio.findFirst({
        where: { id, userId },
        include: { stock: true },
      });

      if (!portfolio) return null;

      return new Portfolio(
        portfolio.id,
        portfolio.userId,
        portfolio.stockId,
        portfolio.quantity,
        portfolio.averagePrice,
        portfolio.totalCost,
        portfolio.currentValue,
        portfolio.profit,
        portfolio.profitRate,
        portfolio.createdAt,
        portfolio.updatedAt
      ).recalculate(portfolio.stock.currentPrice);
    } catch (error) {
      logger.error('PortfolioRepositoryAdapter.findById error:', error);
      throw new DatabaseError('Failed to fetch portfolio from database');
    }
  }

  async findByUserAndStock(userId: string, stockId: string): Promise<Portfolio | null> {
    try {
      const portfolio = await this.client.portfolio.findUnique({
        where: {
          userId_stockId: { userId, stockId },
        },
        include: { stock: true },
      });

      if (!portfolio) return null;

      return new Portfolio(
        portfolio.id,
        portfolio.userId,
        portfolio.stockId,
        portfolio.quantity,
        portfolio.averagePrice,
        portfolio.totalCost,
        portfolio.currentValue,
        portfolio.profit,
        portfolio.profitRate,
        portfolio.createdAt,
        portfolio.updatedAt
      ).recalculate(portfolio.stock.currentPrice);
    } catch (error) {
      logger.error('PortfolioRepositoryAdapter.findByUserAndStock error:', error);
      throw new DatabaseError('Failed to fetch portfolio from database');
    }
  }

  async create(portfolio: Portfolio): Promise<Portfolio> {
    try {
      const created = await this.client.portfolio.create({
        data: {
          userId: portfolio.userId,
          stockId: portfolio.stockId,
          quantity: portfolio.quantity,
          averagePrice: portfolio.averagePrice,
          totalCost: portfolio.totalCost,
          currentValue: portfolio.currentValue,
          profit: portfolio.profit,
          profitRate: portfolio.profitRate,
        },
        include: { stock: true },
      });

      return new Portfolio(
        created.id,
        created.userId,
        created.stockId,
        created.quantity,
        created.averagePrice,
        created.totalCost,
        created.currentValue,
        created.profit,
        created.profitRate,
        created.createdAt,
        created.updatedAt
      );
    } catch (error) {
      logger.error('PortfolioRepositoryAdapter.create error:', error);
      throw new DatabaseError('Failed to create portfolio in database');
    }
  }

  async update(id: string, data: Partial<Portfolio>): Promise<Portfolio> {
    try {
      const updated = await this.client.portfolio.update({
        where: { id },
        data: {
          quantity: data.quantity,
          averagePrice: data.averagePrice,
          totalCost: data.totalCost,
          currentValue: data.currentValue,
          profit: data.profit,
          profitRate: data.profitRate,
        },
        include: { stock: true },
      });

      return new Portfolio(
        updated.id,
        updated.userId,
        updated.stockId,
        updated.quantity,
        updated.averagePrice,
        updated.totalCost,
        updated.currentValue,
        updated.profit,
        updated.profitRate,
        updated.createdAt,
        updated.updatedAt
      );
    } catch (error) {
      logger.error('PortfolioRepositoryAdapter.update error:', error);
      throw new DatabaseError('Failed to update portfolio in database');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.portfolio.delete({ where: { id } });
    } catch (error) {
      logger.error('PortfolioRepositoryAdapter.delete error:', error);
      throw new DatabaseError('Failed to delete portfolio from database');
    }
  }
}
