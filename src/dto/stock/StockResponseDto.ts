export class StockResponseDto {
  constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly name: string,
    public readonly market: string,
    public readonly sector: string | null,
    public readonly currentPrice: number,
    public readonly change: number,
    public readonly changePercent: number,
    public readonly volume: number
  ) {}

  static to(data: {
    id: string;
    code: string;
    name: string;
    market: string;
    sector: string | null;
    currentPrice: number;
    change: number;
    changeRate: number;
    volume: number;
  }): StockResponseDto {
    return new StockResponseDto(
      data.id,
      data.code,
      data.name,
      data.market,
      data.sector,
      data.currentPrice,
      data.change,
      data.changeRate,
      data.volume
    );
  }
}

export class StockDetailResponseDto extends StockResponseDto {
  constructor(
    id: string,
    code: string,
    name: string,
    market: string,
    sector: string | null,
    currentPrice: number,
    change: number,
    changePercent: number,
    volume: number,
    public readonly high: number,
    public readonly low: number,
    public readonly open: number,
    public readonly marketCap: number,
    public readonly chartData?: Array<{
      time: string;
      value: number; // 하위 호환성 (close와 동일)
      volume: number;
      open?: number;
      high?: number;
      low?: number;
      close?: number;
    }>
  ) {
    super(id, code, name, market, sector, currentPrice, change, changePercent, volume);
  }

  // 부모 클래스의 static to 메서드를 override할 수 없으므로 별도 메서드 사용
  static fromDetail(
    code: string,
    name: string,
    market: string,
    detail: {
      currentPrice: number;
      change: number;
      changePercent: number;
      volume: number;
      high: number;
      low: number;
      open: number;
      marketCap: number;
    },
    chartData?: Array<{
      time: string;
      value: number; // 하위 호환성 (close와 동일)
      volume: number;
      open?: number;
      high?: number;
      low?: number;
      close?: number;
    }>
  ): StockDetailResponseDto {
    return new StockDetailResponseDto(
      code,
      code,
      name,
      market,
      null, // sector
      detail.currentPrice,
      detail.change,
      detail.changePercent,
      detail.volume,
      detail.high,
      detail.low,
      detail.open,
      detail.marketCap,
      chartData
    );
  }
}
