import { History } from '../entities/History';

export interface IHistoryRepository {
  findAll(userId: string, limit?: number, offset?: number): Promise<{
    data: History[];
    total: number;
  }>;
  findById(id: string, userId: string): Promise<History | null>;
  findByUserAndStock(userId: string, stockId: string, hours?: number): Promise<History | null>;
  create(history: History): Promise<History>;
  deleteAll(userId: string): Promise<void>;
}

