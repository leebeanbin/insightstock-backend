import { Portfolio } from '../../entities/Portfolio';
import { Stock } from '../../entities/Stock';

export class PortfolioResponseDto {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly stockId: string,
    public readonly stock: {
      code: string;
      name: string;
      market: string;
      currentPrice: number;
      change: number;
      changeRate: number;
    },
    public readonly quantity: number,
    public readonly averagePrice: number,
    public readonly totalCost: number,
    public readonly currentValue: number,
    public readonly profit: number,
    public readonly profitRate: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static to(portfolio: Portfolio, stock: Stock): PortfolioResponseDto {
    return new PortfolioResponseDto(
      portfolio.id,
      portfolio.userId,
      portfolio.stockId,
      {
        code: stock.code,
        name: stock.name,
        market: stock.market,
        currentPrice: stock.currentPrice,
        change: stock.change,
        changeRate: stock.changeRate,
      },
      portfolio.quantity,
      portfolio.averagePrice,
      portfolio.totalCost,
      portfolio.currentValue,
      portfolio.profit,
      portfolio.profitRate,
      portfolio.createdAt,
      portfolio.updatedAt
    );
  }
}
