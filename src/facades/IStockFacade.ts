import { StockResponseDto, StockDetailResponseDto } from '../dto/stock/StockResponseDto';

export interface IStockFacade {
  getStocksByCategory(category: string): Promise<StockResponseDto[]>;
  searchStocks(query: string): Promise<StockResponseDto[]>;
  getStockByCode(
    code: string, 
    includeChart?: boolean, 
    period?: number,
    interval?: string,
    dateRange?: { start: string; end: string } | null
  ): Promise<StockDetailResponseDto | null>;
  getCategories(): string[];
}
