import { History } from '../../entities/History';
import { Stock } from '../../entities/Stock';

export class HistoryResponseDto {
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
    public readonly type: string,
    public readonly viewedAt: Date
  ) {}

  static to(history: History, stock: Stock): HistoryResponseDto {
    return new HistoryResponseDto(
      history.id,
      history.userId,
      history.stockId,
      {
        code: stock.code,
        name: stock.name,
        market: stock.market,
        currentPrice: stock.currentPrice,
        change: stock.change,
        changeRate: stock.changeRate,
      },
      history.type,
      history.viewedAt
    );
  }
}
