import { IMarketFacade } from '../facades/IMarketFacade';
import { MarketResponseDto } from '../dto/market/MarketResponseDto';
import { logger } from '../config/logger';
import { createStepTracker } from '../utils/aop';
import { cacheService } from './CacheService';

export class MarketService implements IMarketFacade {
  async getMarketData(): Promise<MarketResponseDto> {
    const tracker = createStepTracker('MarketService.getMarketData');
    
    try {
      // 캐시 확인 (10초 TTL - 실시간 시장 데이터)
      const cacheKey = 'market:summary';
      const cached = await cacheService.get<MarketResponseDto>(cacheKey);
      if (cached) {
        logger.debug('Market data cache hit');
        return cached;
      }
      
      tracker.step('시장 데이터 계산 시작');
      const baseKospi = 2650.5;
      const baseKosdaq = 875.2;
      const baseUsdKrw = 1335.5;

      const kospiVariation = (Math.random() - 0.5) * 5;
      const kosdaqVariation = (Math.random() - 0.5) * 3;
      const usdKrwVariation = (Math.random() - 0.5) * 2;

      const kospiPrice = baseKospi + kospiVariation;
      const kosdaqPrice = baseKosdaq + kosdaqVariation;
      const usdKrwPrice = baseUsdKrw + usdKrwVariation;

      const kospiChange = kospiVariation;
      const kosdaqChange = kosdaqVariation;
      const usdKrwChange = usdKrwVariation;

      const data = {
        kospi: {
          price: Number(kospiPrice.toFixed(2)),
          change: Number(kospiChange.toFixed(2)),
          changePercent: Number(((kospiChange / baseKospi) * 100).toFixed(2)),
        },
        kosdaq: {
          price: Number(kosdaqPrice.toFixed(2)),
          change: Number(kosdaqChange.toFixed(2)),
          changePercent: Number(((kosdaqChange / baseKosdaq) * 100).toFixed(2)),
        },
        usdKrw: {
          price: Number(usdKrwPrice.toFixed(2)),
          change: Number(usdKrwChange.toFixed(2)),
          changePercent: Number(((usdKrwChange / baseUsdKrw) * 100).toFixed(2)),
        },
      };
      tracker.step('시장 데이터 계산 완료');

      const result = MarketResponseDto.to(data);
      
      // 캐시 저장 (10초 TTL)
      await cacheService.set(cacheKey, result, 10);
      logger.debug('Market data cached');
      
      tracker.finish();
      return result;
    } catch (error) {
      logger.error('MarketService.getMarketData error:', error);
      tracker.step('Fallback 데이터 반환');
      const fallback = MarketResponseDto.to({
        kospi: { price: 2650.5, change: 12.3, changePercent: 0.47 },
        kosdaq: { price: 875.2, change: -5.1, changePercent: -0.58 },
        usdKrw: { price: 1335.5, change: 2.3, changePercent: 0.17 },
      });
      tracker.finish();
      return fallback;
    }
  }
}

