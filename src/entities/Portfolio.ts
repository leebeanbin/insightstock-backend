export class Portfolio {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly stockId: string,
    public readonly quantity: number,
    public readonly averagePrice: number,
    public readonly totalCost: number,
    public readonly currentValue: number,
    public readonly profit: number,
    public readonly profitRate: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(data: {
    id: string;
    userId: string;
    stockId: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
  }): Portfolio {
    const totalCost = data.quantity * data.averagePrice;
    const currentValue = data.quantity * data.currentPrice;
    const profit = currentValue - totalCost;
    const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    return new Portfolio(
      data.id,
      data.userId,
      data.stockId,
      data.quantity,
      data.averagePrice,
      totalCost,
      currentValue,
      profit,
      profitRate,
      new Date(),
      new Date()
    );
  }

  recalculate(currentPrice: number): Portfolio {
    const totalCost = this.quantity * this.averagePrice;
    const currentValue = this.quantity * currentPrice;
    const profit = currentValue - totalCost;
    const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    return new Portfolio(
      this.id,
      this.userId,
      this.stockId,
      this.quantity,
      this.averagePrice,
      totalCost,
      currentValue,
      profit,
      profitRate,
      this.createdAt,
      new Date()
    );
  }
}
