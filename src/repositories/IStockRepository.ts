import { Stock } from '../entities/Stock';

export interface IStockRepository {
  findById(id: string): Promise<Stock | null>;
  findByCode(code: string): Promise<Stock | null>;
  findMany(ids: string[]): Promise<Stock[]>;
}
