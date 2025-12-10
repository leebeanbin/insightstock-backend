import { NewsResponseDto } from '../dto/news/NewsResponseDto';

export interface INewsFacade {
  getNews(params: {
    stockCode?: string;
    limit?: number;
    offset?: number;
    sentiment?: string;
  }): Promise<{
    data: NewsResponseDto[];
    total: number;
  }>;
  getNewsByStockCode(stockCode: string, limit?: number): Promise<{
    data: NewsResponseDto[];
    total: number;
  }>;
  getNewsById(id: string): Promise<NewsResponseDto | null>;
}

