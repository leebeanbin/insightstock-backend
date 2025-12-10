import { HistoryResponseDto } from '../dto/history/HistoryResponseDto';
import { CreateHistoryDto } from '../dto/history/CreateHistoryDto';

export interface IHistoryFacade {
  getHistory(userId: string, limit?: number, offset?: number): Promise<{
    data: HistoryResponseDto[];
    total: number;
  }>;
  addHistory(userId: string, dto: CreateHistoryDto): Promise<HistoryResponseDto>;
  clearHistory(userId: string): Promise<void>;
  findRecent(userId: string, stockId: string, timeWindow: number): Promise<HistoryResponseDto | null>;
}

