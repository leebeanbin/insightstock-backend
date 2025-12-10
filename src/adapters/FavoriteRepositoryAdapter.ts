import { IFavoriteRepository } from '../repositories/IFavoriteRepository';
import { Favorite } from '../entities/Favorite';
import { prisma } from '../config/prisma';
import { DatabaseError } from "../errors/AppError";
import { logger } from '../config/logger';
import { Prisma } from '@prisma/client';

export class FavoriteRepositoryAdapter implements IFavoriteRepository {
  /**
   * 트랜잭션 클라이언트를 선택적으로 받을 수 있도록 확장
   * 트랜잭션이 없으면 기본 prisma 클라이언트 사용
   */
  constructor(private readonly tx?: Prisma.TransactionClient) {}

  /**
   * 트랜잭션 클라이언트를 사용하는 새로운 인스턴스 생성
   * 트랜잭션 내에서 Repository를 사용할 때 호출
   */
  static withTransaction(tx: Prisma.TransactionClient): FavoriteRepositoryAdapter {
    return new FavoriteRepositoryAdapter(tx);
  }

  private get client() {
    return this.tx || prisma;
  }

  async findAll(userId: string): Promise<Favorite[]> {
    try {
      const favorites = await this.client.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return favorites.map(
        (f) => new Favorite(f.id, f.userId, f.stockId, f.createdAt)
      );
    } catch (error) {
      logger.error('FavoriteRepositoryAdapter.findAll error:', error);
      throw new DatabaseError('Failed to fetch favorites from database');
    }
  }

  async findById(id: string, userId: string): Promise<Favorite | null> {
    try {
      const favorite = await this.client.favorite.findFirst({
        where: { id, userId },
      });

      if (!favorite) return null;

      return new Favorite(favorite.id, favorite.userId, favorite.stockId, favorite.createdAt);
    } catch (error) {
      logger.error('FavoriteRepositoryAdapter.findById error:', error);
      throw new DatabaseError('Failed to fetch favorite from database');
    }
  }

  async findByUserAndStock(userId: string, stockId: string): Promise<Favorite | null> {
    try {
      const favorite = await this.client.favorite.findUnique({
        where: {
          userId_stockId: { userId, stockId },
        },
      });

      if (!favorite) return null;

      return new Favorite(favorite.id, favorite.userId, favorite.stockId, favorite.createdAt);
    } catch (error) {
      logger.error('FavoriteRepositoryAdapter.findByUserAndStock error:', error);
      throw new DatabaseError('Failed to fetch favorite from database');
    }
  }

  async create(favorite: Favorite): Promise<Favorite> {
    try {
      const created = await this.client.favorite.create({
        data: {
          userId: favorite.userId,
          stockId: favorite.stockId,
        },
      });

      return new Favorite(created.id, created.userId, created.stockId, created.createdAt);
    } catch (error) {
      logger.error('FavoriteRepositoryAdapter.create error:', error);
      throw new DatabaseError('Failed to create favorite in database');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.favorite.delete({ where: { id } });
    } catch (error) {
      logger.error('FavoriteRepositoryAdapter.delete error:', error);
      throw new DatabaseError('Failed to delete favorite from database');
    }
  }
}
