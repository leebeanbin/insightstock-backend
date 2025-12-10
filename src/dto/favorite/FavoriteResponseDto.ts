import { Favorite } from '../../entities/Favorite';
import { Stock } from '../../entities/Stock';

export class FavoriteResponseDto {
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
    public readonly createdAt: Date
  ) {}

  static to(favorite: Favorite, stock: Stock): FavoriteResponseDto {
    return new FavoriteResponseDto(
      favorite.id,
      favorite.userId,
      favorite.stockId,
      {
        code: stock.code,
        name: stock.name,
        market: stock.market,
        currentPrice: stock.currentPrice,
        change: stock.change,
        changeRate: stock.changeRate,
      },
      favorite.createdAt instanceof Date ? favorite.createdAt : new Date(favorite.createdAt)
    );
  }

  // JSON 직렬화를 위한 메서드
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      stockId: this.stockId,
      stock: this.stock,
      createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
    };
  }
}
