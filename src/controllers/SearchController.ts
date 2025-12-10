import { FastifyRequest, FastifyReply } from 'fastify';
import { SearchService } from '../services/SearchService';
import { BadRequestError } from '../errors/AppError';

export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * 통합 검색 (종목 + 뉴스)
   * GET /api/search?q=검색어&limit=20&stockLimit=10&newsLimit=10&includeNews=true
   */
  async search(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { q, limit, stockLimit, newsLimit, includeNews } = request.query as {
      q?: string;
      limit?: string;
      stockLimit?: string;
      newsLimit?: string;
      includeNews?: string;
    };

    if (!q || q.trim().length < 1) {
      throw new BadRequestError('Search query is required');
    }

    const userId = request.userId; // optional auth

    const result = await this.searchService.search(
      q,
      userId,
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        stockLimit: stockLimit ? parseInt(stockLimit, 10) : undefined,
        newsLimit: newsLimit ? parseInt(newsLimit, 10) : undefined,
        includeNews: includeNews !== 'false',
      }
    );

    reply.send({
      success: true,
      data: result,
    });
  }

  /**
   * 종목 검색
   * GET /api/search/stocks?q=검색어&limit=10
   */
  async searchStocks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { q, limit } = request.query as {
      q?: string;
      limit?: string;
    };

    if (!q || q.trim().length < 1) {
      throw new BadRequestError('Search query is required');
    }

    const stocks = await this.searchService.searchStocks(
      q,
      limit ? parseInt(limit, 10) : 10
    );

    reply.send({
      success: true,
      data: stocks,
    });
  }

  /**
   * 뉴스 검색
   * GET /api/search/news?q=검색어&limit=10
   */
  async searchNews(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { q, limit } = request.query as {
      q?: string;
      limit?: string;
    };

    if (!q || q.trim().length < 1) {
      throw new BadRequestError('Search query is required');
    }

    const news = await this.searchService.searchNews(
      q,
      limit ? parseInt(limit, 10) : 10
    );

    reply.send({
      success: true,
      data: news,
    });
  }

  /**
   * 인기 검색어 조회
   * GET /api/search/popular?limit=10
   */
  async getPopularSearches(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { limit } = request.query as {
      limit?: string;
    };

    const popularSearches = await this.searchService.getPopularSearches(
      limit ? parseInt(limit, 10) : 10
    );

    reply.send({
      success: true,
      data: popularSearches,
    });
  }

  /**
   * 자동완성 검색어 제안
   * GET /api/search/suggestions?q=검색어&limit=5
   */
  async getSuggestions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { q, limit } = request.query as {
      q?: string;
      limit?: string;
    };

    if (!q || q.trim().length < 1) {
      reply.send({
        success: true,
        data: [],
      });
      return;
    }

    const suggestions = await this.searchService.getSuggestions(
      q,
      limit ? parseInt(limit, 10) : 5
    );

    reply.send({
      success: true,
      data: suggestions,
    });
  }
}

