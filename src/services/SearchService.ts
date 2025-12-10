/**
 * 통합 검색 서비스
 * 
 * 기능:
 * 1. 종목 검색 (Full-text search)
 * 2. 뉴스 검색 (Full-text search)
 * 3. 인기 검색어 조회
 * 4. 검색 이력 저장
 * 
 * 기술적 배경:
 * - PostgreSQL Full-text search (tsvector, tsquery)
 * - 검색 이력 기반 인기 검색어 추적
 * - 검색 결과 캐싱 (Redis)
 */

import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { createStepTracker } from '../utils/aop';
import { StockResponseDto } from '../dto/stock/StockResponseDto';
import { NewsResponseDto } from '../dto/news/NewsResponseDto';
import { cacheService } from './CacheService';

export interface SearchResult {
  stocks: StockResponseDto[];
  news: NewsResponseDto[];
  total: {
    stocks: number;
    news: number;
  };
}

export interface PopularSearchTerm {
  term: string;
  count: number;
  lastSearched: Date;
}

export class SearchService {
  /**
   * 통합 검색 (종목 + 뉴스)
   * 
   * @param query 검색어
   * @param userId 사용자 ID (검색 이력 저장용)
   * @param options 검색 옵션
   */
  async search(
    query: string,
    userId?: string,
    options: {
      limit?: number;
      stockLimit?: number;
      newsLimit?: number;
      includeNews?: boolean;
    } = {}
  ): Promise<SearchResult> {
    const tracker = createStepTracker('SearchService.search');
    
    if (!query || query.trim().length < 1) {
      tracker.finish();
      return {
        stocks: [],
        news: [],
        total: { stocks: 0, news: 0 },
      };
    }

    const normalizedQuery = query.trim();
    const {
      limit = 20,
      stockLimit = 10,
      newsLimit = 10,
      includeNews = true,
    } = options;

    // 검색 결과 캐싱 (5분)
    const cacheKey = `search:${normalizedQuery}:${stockLimit}:${newsLimit}`;
    const cached = await cacheService.get<SearchResult>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for search:${normalizedQuery}`);
      tracker.finish();
      return cached;
    }

    tracker.step('종목 검색 시작');
    const stocks = await this.searchStocks(normalizedQuery, stockLimit);
    tracker.step('종목 검색 완료');

    let news: NewsResponseDto[] = [];
    if (includeNews) {
      tracker.step('뉴스 검색 시작');
      news = await this.searchNews(normalizedQuery, newsLimit);
      tracker.step('뉴스 검색 완료');
    }

    // 검색 이력 저장 (비동기, 에러 무시)
    if (userId) {
      this.saveSearchHistory(userId, normalizedQuery).catch((error) => {
        logger.warn('Failed to save search history:', error);
      });
    }

    const result: SearchResult = {
      stocks,
      news,
      total: {
        stocks: stocks.length,
        news: news.length,
      },
    };

    // 캐시 저장 (TTL: 5분)
    await cacheService.set(cacheKey, result, 300);
    
    tracker.finish();
    return result;
  }

  /**
   * 종목 검색 (Full-text search)
   * 
   * PostgreSQL Full-text search 사용:
   * - to_tsvector: 텍스트를 검색 가능한 벡터로 변환
   * - to_tsquery: 검색어를 쿼리로 변환
   * - 한국어는 기본 지원이 제한적이므로 ILIKE도 함께 사용
   */
  async searchStocks(query: string, limit: number = 10): Promise<StockResponseDto[]> {
    const tracker = createStepTracker('SearchService.searchStocks');
    
    try {
      // 검색어 정규화 (공백 제거, 소문자 변환)
      const normalizedQuery = query.trim().toLowerCase();
      
      // PostgreSQL Full-text search + ILIKE 조합
      // 1. 코드로 검색 (정확한 매칭 우선)
      // 2. 이름으로 검색 (ILIKE 패턴 매칭)
      // 3. 섹터로 검색
      
      tracker.step('DB 쿼리 실행');
      const stocks = await prisma.stock.findMany({
        where: {
          OR: [
            // 코드 정확 매칭 (우선순위 높음)
            { code: { equals: normalizedQuery, mode: 'insensitive' } },
            // 이름 부분 매칭
            { name: { contains: normalizedQuery, mode: 'insensitive' } },
            // 섹터 매칭
            { sector: { contains: normalizedQuery, mode: 'insensitive' } },
          ],
        },
        orderBy: [
          // 코드 정확 매칭 우선
          { code: normalizedQuery === normalizedQuery ? 'asc' : 'desc' },
          // 이름 매칭 우선
          { name: 'asc' },
        ],
        take: limit,
      });
      tracker.step('DB 쿼리 완료');

      tracker.step('DTO 변환');
      const result = stocks.map((stock) =>
        StockResponseDto.to({
          id: stock.id,
          code: stock.code,
          name: stock.name,
          market: stock.market,
          sector: stock.sector || '',
          currentPrice: stock.currentPrice,
          change: stock.change,
          changeRate: stock.changeRate,
          volume: Number(stock.volume),
        })
      );
      tracker.step('DTO 변환 완료');
      
      tracker.finish();
      return result;
    } catch (error) {
      logger.error('SearchService.searchStocks error:', error);
      tracker.finish();
      return [];
    }
  }

  /**
   * 뉴스 검색 (Full-text search)
   * 
   * PostgreSQL Full-text search 사용:
   * - title, content, summary에서 검색
   * - 관련 종목 코드도 함께 반환
   */
  async searchNews(query: string, limit: number = 10): Promise<NewsResponseDto[]> {
    const tracker = createStepTracker('SearchService.searchNews');
    
    try {
      const normalizedQuery = query.trim().toLowerCase();
      
      tracker.step('DB 쿼리 실행');
      // PostgreSQL Full-text search
      // title, content, summary에서 검색
      const news = await prisma.news.findMany({
        where: {
          OR: [
            { title: { contains: normalizedQuery, mode: 'insensitive' } },
            { content: { contains: normalizedQuery, mode: 'insensitive' } },
            { summary: { contains: normalizedQuery, mode: 'insensitive' } },
          ],
        },
        include: {
          stocks: {
            include: {
              stock: true,
            },
          },
        },
        orderBy: [
          // 제목 매칭 우선
          { publishedAt: 'desc' },
        ],
        take: limit,
      });
      tracker.step('DB 쿼리 완료');

      tracker.step('DTO 변환');
      const result = news.map((n) => {
        const stockCodes = n.stocks.map((ns) => ns.stock.code);
        return NewsResponseDto.to(
          {
            id: n.id,
            title: n.title,
            content: n.content,
            summary: n.summary,
            source: n.source,
            url: n.url,
            publishedAt: n.publishedAt,
            sentiment: n.sentiment,
            sentimentScore: n.sentimentScore,
            thumbnailUrl: n.thumbnailUrl,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
          },
          stockCodes
        );
      });
      tracker.step('DTO 변환 완료');
      
      tracker.finish();
      return result;
    } catch (error) {
      logger.error('SearchService.searchNews error:', error);
      tracker.finish();
      return [];
    }
  }

  /**
   * 인기 검색어 조회
   * 
   * 검색 이력 기반으로 인기 검색어를 계산
   * - 최근 7일간의 검색 이력
   * - 검색 횟수 기준 정렬
   */
  async getPopularSearches(limit: number = 10): Promise<PopularSearchTerm[]> {
    const tracker = createStepTracker('SearchService.getPopularSearches');
    
    try {
      // 캐싱 (10분)
      const cacheKey = `popular-searches:${limit}`;
      const cached = await cacheService.get<PopularSearchTerm[]>(cacheKey);
      if (cached) {
        logger.debug('Cache hit for popular searches');
        tracker.finish();
        return cached;
      }

      tracker.step('검색 이력 조회 (Raw Query 최적화)');
      // 최근 7일간의 검색 이력
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Raw Query를 사용한 최적화된 집계 쿼리
      const popularSearchesRaw = await prisma.$queryRaw<Array<{
        term: string;
        count: bigint;
        last_searched: Date;
      }>>`
        SELECT 
          COALESCE(s.code, s.name) as term,
          COUNT(*)::bigint as count,
          MAX(h.viewed_at) as last_searched
        FROM histories h
        INNER JOIN stocks s ON h.stock_id = s.id
        WHERE h.type = 'search'
          AND h.viewed_at >= ${sevenDaysAgo}
        GROUP BY COALESCE(s.code, s.name)
        ORDER BY count DESC, last_searched DESC
        LIMIT ${limit}
      `;

      // BigInt를 Number로 변환
      const popularSearches = popularSearchesRaw.map((item) => ({
        term: item.term,
        count: Number(item.count),
        lastSearched: item.last_searched,
      }));

      tracker.step('인기 검색어 정렬 완료');

      // 캐시 저장 (TTL: 10분)
      await cacheService.set(cacheKey, popularSearches, 600);
      
      tracker.finish();
      return popularSearches;
    } catch (error) {
      logger.error('SearchService.getPopularSearches error:', error);
      tracker.finish();
      return [];
    }
  }

  /**
   * 검색 이력 저장
   * 
   * HistoryService를 통해 검색 이력을 저장
   * (중복 방지: 최근 5분 내 같은 검색은 저장하지 않음)
   */
  private async saveSearchHistory(userId: string, query: string): Promise<void> {
    try {
      // 검색어를 Stock Code 또는 Name으로 변환 시도
      const stock = await prisma.stock.findFirst({
        where: {
          OR: [
            { code: { equals: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
          ],
        },
      });

      if (stock) {
        // HistoryService를 통해 저장 (중복 체크 포함)
        const { HistoryService } = await import('./HistoryService');
        const { HistoryRepositoryAdapter } = await import('../adapters/HistoryRepositoryAdapter');
        const { StockRepositoryAdapter } = await import('../adapters/StockRepositoryAdapter');

        const historyRepository = new HistoryRepositoryAdapter();
        const stockRepository = new StockRepositoryAdapter();
        const historyService = new HistoryService(historyRepository, stockRepository);

        await historyService.addHistory(userId, {
          stockId: stock.id,
          type: 'search',
        });
      }
    } catch (error) {
      logger.warn('Failed to save search history:', error);
      // 검색 이력 저장 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }

  /**
   * 자동완성 검색어 제안
   * 
   * 사용자가 입력한 검색어의 일부로 시작하는 종목명/코드 제안
   */
  async getSuggestions(query: string, limit: number = 5): Promise<string[]> {
    const tracker = createStepTracker('SearchService.getSuggestions');
    
    if (!query || query.trim().length < 1) {
      tracker.finish();
      return [];
    }

    try {
      const normalizedQuery = query.trim().toLowerCase();
      
      // 캐싱 (5분)
      const cacheKey = `search-suggestions:${normalizedQuery}:${limit}`;
      const cached = await cacheService.get<string[]>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for suggestions:${normalizedQuery}`);
        tracker.finish();
        return cached;
      }

      tracker.step('자동완성 쿼리 실행');
      const stocks = await prisma.stock.findMany({
        where: {
          OR: [
            { code: { startsWith: normalizedQuery, mode: 'insensitive' } },
            { name: { startsWith: normalizedQuery, mode: 'insensitive' } },
          ],
        },
        orderBy: [
          // 코드 매칭 우선
          { code: 'asc' },
        ],
        take: limit,
        select: {
          code: true,
          name: true,
        },
      });
      tracker.step('자동완성 쿼리 완료');

      // 종목명과 코드를 모두 제안
      const suggestions = stocks.flatMap((stock) => [
        stock.name,
        stock.code,
      ]).slice(0, limit);

      // 캐시 저장 (TTL: 5분)
      await cacheService.set(cacheKey, suggestions, 300);
      
      tracker.finish();
      return suggestions;
    } catch (error) {
      logger.error('SearchService.getSuggestions error:', error);
      tracker.finish();
      return [];
    }
  }
}

