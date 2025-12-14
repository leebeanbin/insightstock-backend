import { INewsRepository } from '../repositories/INewsRepository';
import { News } from '../entities/News';
import { prisma } from '../config/prisma';
import { DatabaseError } from "../errors/AppError";
import { logger } from '../config/logger';

export class NewsRepositoryAdapter implements INewsRepository {
  async findMany(params: {
    stockCode?: string;
    limit?: number;
    offset?: number;
    sentiment?: string;
  }): Promise<{
    data: Array<News & { stockCodes: string[] }>;
    total: number;
  }> {
    try {
      const where: any = {};
      if (params.sentiment) {
        where.sentiment = params.sentiment;
      }
      if (params.stockCode) {
        where.stocks = {
          some: {
            stock: {
              code: params.stockCode,
            },
          },
        };
      }

      // 캐시 키 생성 (파라미터 기반)
      const cacheKey = `news:list:${JSON.stringify(params)}`;
      
      const [news, total] = await Promise.all([
        // Prisma Extensions를 사용한 자동 캐싱 (5분 TTL)
        (prisma as any).news.findManyWithCache(
          {
          where,
          include: {
            stocks: {
              include: {
                stock: true,
              },
            },
          },
          orderBy: { publishedAt: 'desc' },
          take: params.limit || 20,
          skip: params.offset || 0,
          },
          cacheKey,
          300 // 5분 캐시
        ),
        prisma.news.count({ where }),
      ]);

      // N+1 문제 해결: 이미 조인된 stocks 데이터 활용
      const data = news.map((n) => {
        const newsEntity = new News(
          n.id,
          n.title,
          n.content,
          n.summary,
          n.source,
          n.url,
          n.publishedAt,
          n.sentiment,
          n.sentimentScore,
          n.thumbnailUrl,
          n.createdAt,
          n.updatedAt
        );
        // 이미 조인된 stocks에서 stockCodes 추출
        const stockCodes = n.stocks.map((ns) => ns.stock.code);
        return { ...newsEntity, stockCodes };
      });

      return { data, total };
    } catch (error) {
      logger.error('NewsRepositoryAdapter.findMany error:', error);
      throw new DatabaseError('Failed to fetch news from database');
    }
  }

  async findById(id: string): Promise<(News & { stockCodes: string[] }) | null> {
    try {
      // Prisma Extensions를 사용한 자동 캐싱 (10분 TTL - 뉴스 상세는 자주 변경되지 않음)
      const news = await (prisma as any).news.findUniqueWithCache(
        {
        where: { id },
        include: {
          stocks: {
            include: {
              stock: true,
            },
          },
        },
        },
        `news:detail:${id}`,
        600 // 10분 캐시
      );

      if (!news) return null;

      const newsEntity = new News(
        news.id,
        news.title,
        news.content,
        news.summary,
        news.source,
        news.url,
        news.publishedAt,
        news.sentiment,
        news.sentimentScore,
        news.thumbnailUrl,
        news.createdAt,
        news.updatedAt
      );
      // 이미 조인된 stocks에서 stockCodes 추출
      const stockCodes = news.stocks.map((ns) => ns.stock.code);
      return { ...newsEntity, stockCodes };
    } catch (error) {
      logger.error('NewsRepositoryAdapter.findById error:', error);
      throw new DatabaseError('Failed to fetch news from database');
    }
  }

  async findByStockCode(stockCode: string, limit: number = 20): Promise<{
    data: Array<News & { stockCodes: string[] }>;
    total: number;
  }> {
    try {
      const where = {
        stocks: {
          some: {
            stock: {
              code: stockCode,
            },
          },
        },
      };

      // 캐시 키 생성
      const cacheKey = `news:stock:${stockCode}:${limit}`;

      const [news, total] = await Promise.all([
        // Prisma Extensions를 사용한 자동 캐싱 (5분 TTL)
        (prisma as any).news.findManyWithCache(
          {
          where,
          include: {
            stocks: {
              include: {
                stock: true,
              },
            },
          },
          orderBy: { publishedAt: 'desc' },
          take: limit,
          },
          cacheKey,
          300 // 5분 캐시
        ),
        prisma.news.count({ where }),
      ]);

      // N+1 문제 해결: 이미 조인된 stocks 데이터 활용
      const data = news.map((n) => {
        const newsEntity = new News(
          n.id,
          n.title,
          n.content,
          n.summary,
          n.source,
          n.url,
          n.publishedAt,
          n.sentiment,
          n.sentimentScore,
          n.thumbnailUrl,
          n.createdAt,
          n.updatedAt
        );
        // 이미 조인된 stocks에서 stockCodes 추출
        const stockCodes = n.stocks.map((ns) => ns.stock.code);
        return { ...newsEntity, stockCodes };
      });

      return { data, total };
    } catch (error) {
      logger.error('NewsRepositoryAdapter.findByStockCode error:', error);
      throw new DatabaseError('Failed to fetch news from database');
    }
  }

  async getStockCodesByNewsId(newsId: string): Promise<string[]> {
    try {
      const newsStocks = await prisma.newsStock.findMany({
        where: { newsId },
        include: { stock: true },
      });
      return newsStocks.map((ns) => ns.stock.code);
    } catch (error) {
      logger.error('NewsRepositoryAdapter.getStockCodesByNewsId error:', error);
      throw new DatabaseError('Failed to fetch stock codes from database');
    }
  }
}

