import { INewsFacade } from '../facades/INewsFacade';
import { INewsRepository } from '../repositories/INewsRepository';
import { NewsResponseDto } from '../dto/news/NewsResponseDto';
import { NotFoundError } from '../errors/AppError';
import { createStepTracker } from '../utils/aop';
import { cacheService } from './CacheService';
import { logger } from '../config/logger';

export class NewsService implements INewsFacade {
  constructor(private readonly newsRepository: INewsRepository) {}

  async getNews(params: {
    stockCode?: string;
    limit?: number;
    offset?: number;
    sentiment?: string;
  }): Promise<{
    data: NewsResponseDto[];
    total: number;
  }> {
    const tracker = createStepTracker('NewsService.getNews');
    
    // ✅ 캐싱 추가: 5분 TTL (뉴스 목록은 자주 변경되지 않음)
    const cacheKey = `news:${JSON.stringify(params)}`;
    const cached = await cacheService.get<{ data: NewsResponseDto[]; total: number }>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for news:${JSON.stringify(params)}`);
      tracker.finish();
      return cached;
    }
    
    tracker.step('News 조회 시작');
    // N+1 문제 해결: findMany에서 이미 stockCodes를 포함하여 반환
    const result = await this.newsRepository.findMany(params);
    tracker.step('News 조회 완료');

    tracker.step('DTO 변환 시작');
    // 이미 stockCodes가 포함되어 있으므로 추가 쿼리 없이 바로 변환
    const data = result.data.map((n) => NewsResponseDto.to(n, n.stockCodes));
    tracker.step('DTO 변환 완료');
    
    const response = { data, total: result.total };
    
    // 캐시 저장 (TTL: 5분)
    await cacheService.set(cacheKey, response, 300);
    
    tracker.finish();
    return response;
  }

  async getNewsByStockCode(stockCode: string, limit: number = 20): Promise<{
    data: NewsResponseDto[];
    total: number;
  }> {
    const tracker = createStepTracker('NewsService.getNewsByStockCode');
    
    // ✅ 캐싱 추가: 10분 TTL (종목별 뉴스는 자주 변경되지 않음)
    const cacheKey = `news:stock:${stockCode}:${limit}`;
    const cached = await cacheService.get<{ data: NewsResponseDto[]; total: number }>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for news by stock:${stockCode}`);
      tracker.finish();
      return cached;
    }
    
    tracker.step('News 조회 시작');
    const result = await this.newsRepository.findByStockCode(stockCode, limit);
    tracker.step('News 조회 완료');

    tracker.step('DTO 변환 시작');
    // N+1 문제 해결: findByStockCode에서 이미 stockCodes를 포함하여 반환
    const data = result.data.map((n) => NewsResponseDto.to(n, n.stockCodes));
    tracker.step('DTO 변환 완료');
    
    const response = { data, total: result.total };
    
    // 캐시 저장 (TTL: 10분)
    await cacheService.set(cacheKey, response, 600);
    
    tracker.finish();
    return response;
  }

  async getNewsById(id: string): Promise<NewsResponseDto | null> {
    const tracker = createStepTracker('NewsService.getNewsById');
    
    tracker.step('News 조회 시작');
    const news = await this.newsRepository.findById(id);
    if (!news) {
      tracker.finish();
      return null;
    }
    tracker.step('News 조회 완료');

    tracker.step('DTO 변환');
    // N+1 문제 해결: findById에서 이미 stockCodes를 포함하여 반환
    const result = NewsResponseDto.to(news, news.stockCodes);
    tracker.finish();
    return result;
  }
}

