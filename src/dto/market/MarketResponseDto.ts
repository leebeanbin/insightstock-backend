export class MarketResponseDto {
  constructor(
    public readonly kospi: {
      price: number;
      change: number;
      changePercent: number;
    },
    public readonly kosdaq: {
      price: number;
      change: number;
      changePercent: number;
    },
    public readonly usdKrw: {
      price: number;
      change: number;
      changePercent: number;
    }
  ) {}

  static to(data: {
    kospi: { price: number; change: number; changePercent: number };
    kosdaq: { price: number; change: number; changePercent: number };
    usdKrw: { price: number; change: number; changePercent: number };
  }): MarketResponseDto {
    return new MarketResponseDto(data.kospi, data.kosdaq, data.usdKrw);
  }
}

