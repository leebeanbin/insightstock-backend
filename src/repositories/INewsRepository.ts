import { News } from '../entities/News';

export interface INewsRepository {
  findMany(params: {
    stockCode?: string;
    limit?: number;
    offset?: number;
    sentiment?: string;
  }): Promise<{
    data: Array<News & { stockCodes: string[] }>;
    total: number;
  }>;
  findById(id: string): Promise<(News & { stockCodes: string[] }) | null>;
  findByStockCode(stockCode: string, limit?: number): Promise<{
    data: Array<News & { stockCodes: string[] }>;
    total: number;
  }>;
  getStockCodesByNewsId(newsId: string): Promise<string[]>;
}

