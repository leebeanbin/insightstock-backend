export class Stock {
  constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly name: string,
    public readonly market: string,
    public readonly sector: string | null,
    public readonly currentPrice: number,
    public readonly change: number,
    public readonly changeRate: number,
    public readonly volume: bigint,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
