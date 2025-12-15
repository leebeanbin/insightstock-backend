import { IStockRepository } from '../repositories/IStockRepository';
import { Stock } from '../entities/Stock';
import { prisma } from '../config/prisma';
import { DatabaseError } from "../errors/AppError";
import { logger } from '../config/logger';
import { Prisma } from '@prisma/client';

export class StockRepositoryAdapter implements IStockRepository {
  /**
   * 트랜잭션 클라이언트를 선택적으로 받을 수 있도록 확장
   * 트랜잭션이 없으면 기본 prisma 클라이언트 사용
   */
  constructor(private readonly tx?: Prisma.TransactionClient) {}

  /**
   * 트랜잭션 클라이언트를 사용하는 새로운 인스턴스 생성
   * 트랜잭션 내에서 Repository를 사용할 때 호출
   */
  static withTransaction(tx: Prisma.TransactionClient): StockRepositoryAdapter {
    return new StockRepositoryAdapter(tx);
  }

  private get client() {
    return this.tx || prisma;
  }

  async findById(id: string): Promise<Stock | null> {
    try {
      // Prisma Extensions를 사용한 자동 캐싱 (1분 TTL)
      const stock = await (this.client as any).stock.findUniqueWithCache(
        { where: { id } },
        `stock:id:${id}`,
        60 // 1분 캐시
      );
      if (!stock) return null;

      return new Stock(
        stock.id,
        stock.code,
        stock.name,
        stock.market,
        stock.sector,
        stock.currentPrice,
        stock.change,
        stock.changeRate,
        stock.volume,
        stock.createdAt,
        stock.updatedAt
      );
    } catch (error) {
      logger.error('StockRepositoryAdapter.findById error:', error);
      throw new DatabaseError('Failed to fetch stock from database');
    }
  }

  async findByCode(code: string): Promise<Stock | null> {
    try {
      // Prisma Extensions를 사용한 자동 캐싱 (1분 TTL)
      const stock = await (this.client as any).stock.findUniqueWithCache(
        { where: { code } },
        `stock:${code}`,
        60 // 1분 캐시
      );
      if (!stock) return null;

      return new Stock(
        stock.id,
        stock.code,
        stock.name,
        stock.market,
        stock.sector,
        stock.currentPrice,
        stock.change,
        stock.changeRate,
        stock.volume,
        stock.createdAt,
        stock.updatedAt
      );
    } catch (error) {
      logger.error('StockRepositoryAdapter.findByCode error:', error);
      throw new DatabaseError('Failed to fetch stock from database');
    }
  }

  async findByCodes(codes: string[]): Promise<Stock[]> {
    try {
      // Batch query 최적화: WHERE code IN (...) 사용
      // Prisma Extensions를 사용한 자동 캐싱 (1분 TTL)
      const sortedCodes = [...codes].sort().join(',');
      const stocks = await (this.client as any).stock.findManyWithCache(
        { where: { code: { in: codes } } },
        `stock:codes:${sortedCodes}`,
        60 // 1분 캐시
      );

      return stocks.map(
        (stock) =>
          new Stock(
            stock.id,
            stock.code,
            stock.name,
            stock.market,
            stock.sector,
            stock.currentPrice,
            stock.change,
            stock.changeRate,
            stock.volume,
            stock.createdAt,
            stock.updatedAt
          )
      );
    } catch (error) {
      logger.error('StockRepositoryAdapter.findByCodes error:', error);
      throw new DatabaseError('Failed to fetch stocks by codes from database');
    }
  }

  async findMany(ids: string[]): Promise<Stock[]> {
    try {
      // Prisma Extensions를 사용한 자동 캐싱 (1분 TTL)
      // 캐시 키는 IDs를 정렬하여 일관성 유지
      const sortedIds = [...ids].sort().join(',');
      const stocks = await (this.client as any).stock.findManyWithCache(
        { where: { id: { in: ids } } },
        `stock:many:${sortedIds}`,
        60 // 1분 캐시
      );

      return stocks.map(
        (stock) =>
          new Stock(
            stock.id,
            stock.code,
            stock.name,
            stock.market,
            stock.sector,
            stock.currentPrice,
            stock.change,
            stock.changeRate,
            stock.volume,
            stock.createdAt,
            stock.updatedAt
          )
      );
    } catch (error) {
      logger.error('StockRepositoryAdapter.findMany error:', error);
      throw new DatabaseError('Failed to fetch stocks from database');
    }
  }
}
