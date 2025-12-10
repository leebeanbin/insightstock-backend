import { Portfolio } from '../entities/Portfolio';

export interface IPortfolioRepository {
  findAll(userId: string): Promise<Portfolio[]>;
  findById(id: string, userId: string): Promise<Portfolio | null>;
  findByUserAndStock(userId: string, stockId: string): Promise<Portfolio | null>;
  create(portfolio: Portfolio): Promise<Portfolio>;
  update(id: string, portfolio: Partial<Portfolio>): Promise<Portfolio>;
  delete(id: string): Promise<void>;
}
