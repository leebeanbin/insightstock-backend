import { MarketResponseDto } from '../dto/market/MarketResponseDto';

export interface IMarketFacade {
  getMarketData(): Promise<MarketResponseDto>;
}

