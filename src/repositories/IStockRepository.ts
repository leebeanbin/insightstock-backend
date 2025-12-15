import { Stock } from '../entities/Stock';

export interface IStockRepository {
  findById(id: string): Promise<Stock | null>;
  findByCode(code: string): Promise<Stock | null>;
  findByCodes(codes: string[]): Promise<Stock[]>; // Batch query 최적화
  findMany(ids: string[]): Promise<Stock[]>;
}
