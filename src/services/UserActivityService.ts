import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { cacheService } from './CacheService';

export type NewsActivityType = 'read' | 'like' | 'favorite';

export class UserActivityService {
  /**
   * 뉴스 읽기 기록
   */
  async trackNewsRead(userId: string, newsId: string): Promise<void> {
    try {
      await prisma.newsUserActivity.upsert({
        where: {
          userId_newsId_type: {
            userId,
            newsId,
            type: 'read',
          },
        },
        update: {
          createdAt: new Date(),
        },
        create: {
          userId,
          newsId,
          type: 'read',
        },
      });
    } catch (error) {
      logger.error('UserActivityService.trackNewsRead error:', error);
      // 읽기 추적 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }

  /**
   * 뉴스 좋아요 토글
   */
  async toggleNewsLike(userId: string, newsId: string): Promise<boolean> {
    try {
      const existing = await prisma.newsUserActivity.findUnique({
        where: {
          userId_newsId_type: {
            userId,
            newsId,
            type: 'like',
          },
        },
      });

      if (existing) {
        await prisma.newsUserActivity.delete({
          where: {
            userId_newsId_type: {
              userId,
              newsId,
              type: 'like',
            },
          },
        });
        return false; // 좋아요 취소
      } else {
        await prisma.newsUserActivity.create({
          data: {
            userId,
            newsId,
            type: 'like',
          },
        });
        return true; // 좋아요 추가
      }
    } catch (error) {
      logger.error('UserActivityService.toggleNewsLike error:', error);
      throw error;
    }
  }

  /**
   * 뉴스 즐겨찾기 토글
   */
  async toggleNewsFavorite(userId: string, newsId: string): Promise<boolean> {
    try {
      const existing = await prisma.newsUserActivity.findUnique({
        where: {
          userId_newsId_type: {
            userId,
            newsId,
            type: 'favorite',
          },
        },
      });

      if (existing) {
        await prisma.newsUserActivity.delete({
          where: {
            userId_newsId_type: {
              userId,
              newsId,
              type: 'favorite',
            },
          },
        });
        return false; // 즐겨찾기 취소
      } else {
        await prisma.newsUserActivity.create({
          data: {
            userId,
            newsId,
            type: 'favorite',
          },
        });
        return true; // 즐겨찾기 추가
      }
    } catch (error) {
      logger.error('UserActivityService.toggleNewsFavorite error:', error);
      throw error;
    }
  }

  /**
   * 사용자가 읽은 뉴스 목록 조회
   */
  async getReadNews(userId: string, limit: number = 20): Promise<string[]> {
    try {
      const activities = await prisma.newsUserActivity.findMany({
        where: {
          userId,
          type: 'read',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        select: {
          newsId: true,
        },
      });
      return activities.map((a) => a.newsId);
    } catch (error) {
      logger.error('UserActivityService.getReadNews error:', error);
      return [];
    }
  }

  /**
   * 사용자가 좋아요한 뉴스 목록 조회
   */
  async getLikedNews(userId: string, limit: number = 20): Promise<string[]> {
    try {
      const activities = await prisma.newsUserActivity.findMany({
        where: {
          userId,
          type: 'like',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        select: {
          newsId: true,
        },
      });
      return activities.map((a) => a.newsId);
    } catch (error) {
      logger.error('UserActivityService.getLikedNews error:', error);
      return [];
    }
  }

  /**
   * 사용자가 즐겨찾기한 뉴스 목록 조회
   */
  async getFavoriteNews(userId: string, limit: number = 20): Promise<string[]> {
    try {
      const activities = await prisma.newsUserActivity.findMany({
        where: {
          userId,
          type: 'favorite',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        select: {
          newsId: true,
        },
      });
      return activities.map((a) => a.newsId);
    } catch (error) {
      logger.error('UserActivityService.getFavoriteNews error:', error);
      return [];
    }
  }

  /**
   * 사용자 활동 정보 조회 (챗봇 컨텍스트용)
   * Redis 캐싱: 5분간 캐시 (사용자 활동이 자주 변경되지 않음)
   */
  async getUserContext(userId: string): Promise<{
    readNews: string[];
    likedNews: string[];
    favoriteNews: string[];
    recentStocks: string[];
    learnings: Array<{ concept: string; question: string }>;
    notes: Array<{ title: string; tags: string[] }>;
  }> {
    try {
      // Redis 캐싱: 사용자 컨텍스트는 5분간 캐시
      const cacheKey = `user-context:${userId}`;
      const cached = await cacheService.get<{
        readNews: string[];
        likedNews: string[];
        favoriteNews: string[];
        recentStocks: string[];
        learnings: Array<{ concept: string; question: string }>;
        notes: Array<{ title: string; tags: string[] }>;
      }>(cacheKey);
      
      if (cached) {
        logger.debug(`Cache hit for user-context:${userId}`);
        return cached;
      }

      const [readNews, likedNews, favoriteNews, recentStocks, learnings, notes] = await Promise.all([
        this.getReadNews(userId, 10),
        this.getLikedNews(userId, 10),
        this.getFavoriteNews(userId, 10),
        // 최근 조회한 주식
        prisma.history
          .findMany({
            where: { userId },
            orderBy: { viewedAt: 'desc' },
            take: 10,
            select: { stockId: true },
            distinct: ['stockId'],
          })
          .then((histories) => {
            return prisma.stock
              .findMany({
                where: {
                  id: { in: histories.map((h) => h.stockId) },
                },
                select: { code: true },
              })
              .then((stocks) => stocks.map((s) => s.code));
          }),
        // 최근 학습 내용
        prisma.learning
          .findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              concept: true,
              question: true,
            },
          })
          .then((learnings) =>
            learnings.map((l) => ({
              concept: l.concept,
              question: l.question,
            }))
          ),
        // 최근 노트
        prisma.note
          .findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            take: 10,
            select: {
              title: true,
              tags: true,
            },
          })
          .then((notes) =>
            notes.map((n) => ({
              title: n.title,
              tags: n.tags,
            }))
          ),
      ]);

      const result = {
        readNews,
        likedNews,
        favoriteNews,
        recentStocks,
        learnings,
        notes,
      };

      // 캐시 저장 (TTL: 5분)
      await cacheService.set(cacheKey, result, 300);

      return result;
    } catch (error) {
      logger.error('UserActivityService.getUserContext error:', error);
      return {
        readNews: [],
        likedNews: [],
        favoriteNews: [],
        recentStocks: [],
        learnings: [],
        notes: [],
      };
    }
  }
}

