import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { createStepTracker } from '../utils/aop';

/**
 * Folio 통계 인터페이스
 */
export interface FolioStats {
  totalNotes: number;
  totalHighlights: number; // highlightStart/highlightEnd가 있는 노트 수
  totalTags: number;
  totalStocks: number; // relatedStocks에 포함된 고유 종목 수
  recentActivity: {
    notesLast7Days: number;
    notesLast30Days: number;
  };
  topTags: Array<{ tag: string; count: number }>;
  topStocks: Array<{ stockCode: string; count: number }>;
}

/**
 * Folio 필터 인터페이스
 */
export interface FolioFilters {
  tags?: string[];
  stockCodes?: string[];
  newsId?: string;
  hasHighlight?: boolean; // 하이라이트가 있는 노트만
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Folio 서비스
 * 노트와 하이라이트 통합 관리
 */
export class FolioService {
  /**
   * Folio 통계 조회
   */
  async getStats(userId: string): Promise<FolioStats> {
    const tracker = createStepTracker('FolioService.getStats');

    try {
      tracker.step('통계 조회 시작');

      // 전체 노트 수
      const totalNotes = await prisma.note.count({
        where: { userId },
      });

      // 하이라이트가 있는 노트 수
      const totalHighlights = await prisma.note.count({
        where: {
          userId,
          highlightStart: { not: null },
          highlightEnd: { not: null },
        },
      });

      // 모든 노트의 태그 수집
      const allNotes = await prisma.note.findMany({
        where: { userId },
        select: { tags: true, relatedStocks: true, createdAt: true },
      });

      // 태그 통계
      const tagCounts = new Map<string, number>();
      allNotes.forEach((note) => {
        note.tags.forEach((tag) => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });
      const topTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // 종목 통계
      const stockCounts = new Map<string, number>();
      allNotes.forEach((note) => {
        note.relatedStocks.forEach((stockCode) => {
          stockCounts.set(stockCode, (stockCounts.get(stockCode) || 0) + 1);
        });
      });
      const topStocks = Array.from(stockCounts.entries())
        .map(([stockCode, count]) => ({ stockCode, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // 최근 활동 통계
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const notesLast7Days = await prisma.note.count({
        where: {
          userId,
          createdAt: { gte: sevenDaysAgo },
        },
      });

      const notesLast30Days = await prisma.note.count({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      tracker.step('통계 조회 완료');

      const result: FolioStats = {
        totalNotes,
        totalHighlights,
        totalTags: tagCounts.size,
        totalStocks: stockCounts.size,
        recentActivity: {
          notesLast7Days,
          notesLast30Days,
        },
        topTags,
        topStocks,
      };

      tracker.finish();
      return result;
    } catch (error) {
      logger.error('FolioService.getStats error:', error);
      tracker.finish();
      throw error;
    }
  }

  /**
   * 필터링된 노트 목록 조회
   */
  async getFilteredNotes(userId: string, filters: FolioFilters = {}) {
    const tracker = createStepTracker('FolioService.getFilteredNotes');

    try {
      tracker.step('필터링 시작');

      const where: any = { userId };

      // 태그 필터
      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags };
      }

      // 종목 필터
      if (filters.stockCodes && filters.stockCodes.length > 0) {
        where.relatedStocks = { hasSome: filters.stockCodes };
      }

      // 뉴스 필터
      if (filters.newsId) {
        where.newsId = filters.newsId;
      }

      // 하이라이트 필터
      if (filters.hasHighlight === true) {
        where.highlightStart = { not: null };
        where.highlightEnd = { not: null };
      }

      // 날짜 필터
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.createdAt.lte = filters.endDate;
        }
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      tracker.step('DB 조회 시작');
      const [notes, total] = await Promise.all([
        prisma.note.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.note.count({ where }),
      ]);

      tracker.step('DTO 변환');
      const result = {
        notes: notes.map((note) => ({
          id: note.id,
          title: note.title,
          content: note.content,
          tags: note.tags || [],
          newsId: note.newsId ?? undefined,
          scrapedContent: note.scrapedContent ?? undefined,
          sourceUrl: note.sourceUrl ?? undefined,
          highlightStart: note.highlightStart ?? undefined,
          highlightEnd: note.highlightEnd ?? undefined,
          relatedStocks: note.relatedStocks || [],
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        })),
        total,
      };

      tracker.finish();
      return result;
    } catch (error) {
      logger.error('FolioService.getFilteredNotes error:', error);
      tracker.finish();
      throw error;
    }
  }
}

