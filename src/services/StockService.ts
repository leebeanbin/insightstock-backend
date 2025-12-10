import { IStockFacade } from '../facades/IStockFacade';
import { StockResponseDto, StockDetailResponseDto } from '../dto/stock/StockResponseDto';
// TODO: 실제 증권 API 연결 시 활성화
// import { NaverStockApiAdapter } from '../adapters/NaverStockApiAdapter';
import { StockRepositoryAdapter } from '../adapters/StockRepositoryAdapter';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { createStepTracker } from '../utils/aop';

const POPULAR_STOCKS: Record<string, { code: string; name: string; market: string; sector: string }[]> = {
  '인기': [
    { code: '005930', name: '삼성전자', market: 'KOSPI', sector: 'IT' },
    { code: '000660', name: 'SK하이닉스', market: 'KOSPI', sector: 'IT' },
    { code: '373220', name: 'LG에너지솔루션', market: 'KOSPI', sector: '2차전지' },
    { code: '207940', name: '삼성바이오로직스', market: 'KOSPI', sector: '바이오' },
    { code: '005380', name: '현대차', market: 'KOSPI', sector: '자동차' },
    { code: '000270', name: '기아', market: 'KOSPI', sector: '자동차' },
    { code: '035420', name: 'NAVER', market: 'KOSPI', sector: 'IT' },
    { code: '035720', name: '카카오', market: 'KOSPI', sector: 'IT' },
  ],
  '2차전지': [
    { code: '373220', name: 'LG에너지솔루션', market: 'KOSPI', sector: '2차전지' },
    { code: '006400', name: '삼성SDI', market: 'KOSPI', sector: '2차전지' },
  ],
  'IT/반도체': [
    { code: '005930', name: '삼성전자', market: 'KOSPI', sector: 'IT' },
    { code: '000660', name: 'SK하이닉스', market: 'KOSPI', sector: 'IT' },
  ],
  '바이오': [
    { code: '207940', name: '삼성바이오로직스', market: 'KOSPI', sector: '바이오' },
    { code: '068270', name: '셀트리온', market: 'KOSPI', sector: '바이오' },
  ],
  '금융': [
    { code: '105560', name: 'KB금융', market: 'KOSPI', sector: '금융' },
    { code: '055550', name: '신한지주', market: 'KOSPI', sector: '금융' },
  ],
  '자동차': [
    { code: '005380', name: '현대차', market: 'KOSPI', sector: '자동차' },
    { code: '000270', name: '기아', market: 'KOSPI', sector: '자동차' },
  ],
};

export class StockService implements IStockFacade {
  constructor(
    // TODO: 실제 증권 API 연결 시 활성화
    // private readonly naverApi: NaverStockApiAdapter,
    private readonly stockRepo: StockRepositoryAdapter = new StockRepositoryAdapter()
  ) {}

  async getStocksByCategory(category: string): Promise<StockResponseDto[]> {
    const tracker = createStepTracker('StockService.getStocksByCategory');
    
    tracker.step('카테고리별 종목 목록 조회');
    const stockList = POPULAR_STOCKS[category] || POPULAR_STOCKS['인기'];

    tracker.step('병렬 Stock 조회 시작');
    const stocksWithPrice = (await Promise.all(
      stockList.map(async (stock, index) => {
        // 1. DB에서 먼저 조회
        let dbStock = await this.stockRepo.findByCode(stock.code);

        // TODO: 실제 증권 API 연결 시 활성화
        // 2. DB에 없으면 네이버 API 호출 후 DB에 저장
        // if (!dbStock) {
        //   try {
        //     const priceData = await this.naverApi.getStockPrice(stock.code);
        //     
        //     // DB에 저장
        //     await prisma.stock.create({
        //       data: {
        //         code: stock.code,
        //         name: stock.name,
        //         market: stock.market,
        //         sector: stock.sector,
        //         currentPrice: priceData.currentPrice,
        //         change: priceData.change,
        //         changeRate: priceData.changePercent,
        //         volume: BigInt(priceData.volume),
        //       },
        //     });
        //
        //     dbStock = await this.stockRepo.findByCode(stock.code);
        //   } catch (error) {
        //     logger.warn(`Failed to fetch/save stock ${stock.code}:`, error);
        //   }
        // }

        // 3. DB 데이터 사용 또는 네이버 API 데이터 사용
        if (dbStock) {
          return StockResponseDto.to({
            id: dbStock.id,
            code: dbStock.code,
            name: dbStock.name,
            market: dbStock.market,
            sector: dbStock.sector || '',
            currentPrice: dbStock.currentPrice,
            change: dbStock.change,
            changeRate: dbStock.changeRate,
            volume: Number(dbStock.volume),
          });
        } else {
          // DB에 없으면 null 반환 (시드 데이터 필요)
          logger.warn(`Stock ${stock.code} not found in DB. Please run seed script.`);
          return null;
        }
      })
    )).filter((stock): stock is StockResponseDto => stock !== null);
    tracker.step('병렬 Stock 조회 완료');

    tracker.finish();
    return stocksWithPrice;
  }

  async searchStocks(query: string): Promise<StockResponseDto[]> {
    const tracker = createStepTracker('StockService.searchStocks');
    
    if (!query || query.length < 1) {
      tracker.finish();
      return [];
    }

    tracker.step('로컬 검색 시작');
    // TODO: 실제 증권 API 연결 시 활성화
    // try {
    //   const results = await this.naverApi.searchStocks(query);
    //
    //   if (results.length === 0) {
    //     return this.localSearch(query);
    //   }
    //
    //   const stocksWithPrice = await Promise.all(
    //     results.slice(0, 10).map(async (item: any, index: number) => {
    //       const priceData = await this.naverApi.getStockPrice(item.code);
    //       return StockResponseDto.to({
    //         id: `search-${index}`,
    //         code: item.code,
    //         name: item.name,
    //         market: item.typeCode === '0' ? 'KOSPI' : 'KOSDAQ',
    //         sector: '검색결과',
    //         currentPrice: priceData.currentPrice,
    //         change: priceData.change,
    //         changeRate: priceData.changePercent,
    //         volume: priceData.volume,
    //       });
    //     })
    //   );
    //
    //   return stocksWithPrice;
    // } catch (error) {
    //   logger.warn('StockService.searchStocks API error, using local search:', error);
    //   return this.localSearch(query);
    // }

    // 현재는 DB에서만 검색
    const result = this.localSearch(query);
    tracker.step('로컬 검색 완료');
    tracker.finish();
    return result;
  }

  async getStockByCode(
    code: string,
    includeChart: boolean = false,
    period: number = 30,
    interval: string = '1d',
    dateRange: { start: string; end: string } | null = null
  ): Promise<StockDetailResponseDto | null> {
    const tracker = createStepTracker('StockService.getStockByCode');
    
    tracker.step('Stock 조회 시작');
    // 1. DB에서 먼저 조회
    let stock = await this.stockRepo.findByCode(code);
    tracker.step('Stock 조회 완료');

    // TODO: 실제 증권 API 연결 시 활성화
    // 2. DB에 없으면 네이버 API 호출 후 DB에 저장
    // if (!stock) {
    //   logger.info(`Stock ${code} not found in DB, fetching from Naver API`);
    //   const detail = await this.naverApi.getStockDetail(code);
    //   if (!detail) return null;
    //
    //   // DB에 저장
    //   try {
    //     const newStock = await prisma.stock.create({
    //       data: {
    //         code,
    //         name: code, // 네이버 API에서 name을 가져올 수 없으면 code 사용
    //         market: 'KOSPI', // 기본값, 나중에 네이버 API에서 가져오기
    //         currentPrice: detail.currentPrice,
    //         change: detail.change,
    //         changeRate: detail.changePercent,
    //         volume: BigInt(detail.volume),
    //         marketCap: BigInt(detail.marketCap),
    //       },
    //     });
    //
    //     stock = await this.stockRepo.findByCode(code);
    //   } catch (error) {
    //     logger.warn(`Failed to save stock ${code} to DB:`, error);
    //     // DB 저장 실패해도 API 데이터 반환
    //   }
    // }

    if (!stock) {
      logger.warn(`Stock ${code} not found in DB. Please run seed script.`);
      return null;
    }

    // 3. 차트 데이터 조회
    let chartData;
    if (includeChart) {
      tracker.step('차트 데이터 조회 시작');
      // DB에서 가격 이력 조회 시도
      if (stock) {
        // 날짜 범위 필터링
        const dateFilter: { date?: { gte: Date; lte?: Date } } = {};
        if (dateRange) {
          dateFilter.date = {
            gte: new Date(dateRange.start),
            lte: new Date(dateRange.end),
          };
        } else {
          dateFilter.date = {
            gte: new Date(Date.now() - period * 24 * 60 * 60 * 1000),
          };
        }

        // Prisma Extensions를 사용한 자동 캐싱 (차트 데이터는 10초 TTL - 실시간성 중요)
        const stockRecord = await (prisma as any).stock.findUniqueWithCache(
          {
            where: { code },
            include: {
              prices: {
                where: dateFilter,
                orderBy: { date: 'asc' },
              },
            },
          },
          `stock:chart:${code}:${period}:${JSON.stringify(dateFilter)}`,
          10 // 10초 캐시 (차트 데이터는 실시간성 중요)
        );

        if (stockRecord && stockRecord.prices.length > 0) {
          tracker.step('차트 데이터 필터링 시작');
          // 유효한 OHLC 데이터만 필터링 (0이나 null이 아닌 데이터만)
          chartData = stockRecord.prices
            .filter((price) => {
              return (
                price.open != null && price.open > 0 &&
                price.high != null && price.high > 0 &&
                price.low != null && price.low > 0 &&
                price.close != null && price.close > 0
              );
            })
            .map((price) => ({
              time: price.date.toLocaleDateString('ko-KR', {
                month: 'short',
                day: 'numeric',
              }),
              value: price.close, // 하위 호환성
              volume: Number(price.volume) || 0,
              // OHLC 데이터 추가 (캔들스틱 차트용)
              open: Number(price.open),
              high: Number(price.high),
              low: Number(price.low),
              close: Number(price.close),
            }));
          tracker.step('차트 데이터 필터링 완료');
        } else {
          // TODO: 실제 증권 API 연결 시 활성화
          // DB에 없으면 네이버 API 호출
          // chartData = await this.naverApi.getChartData(code, period);
          logger.warn(`Chart data for ${code} not found in DB. Please run seed script.`);
          chartData = [];
        }
        tracker.step('차트 데이터 조회 완료');
      } else {
        // TODO: 실제 증권 API 연결 시 활성화
        // chartData = await this.naverApi.getChartData(code, period);
        logger.warn(`Stock ${code} not found. Cannot fetch chart data.`);
        chartData = [];
      }
    }

    // 4. 응답 생성
    if (stock) {
      tracker.step('MarketCap 및 최신 가격 데이터 조회 시작');
      // Prisma Extensions를 사용한 자동 캐싱 (1분 TTL)
      const stockRecord = await (prisma as any).stock.findUniqueWithCache(
        {
          where: { code },
          select: { 
            marketCap: true,
            prices: {
              orderBy: { date: 'desc' },
              take: 1, // 최신 1개만
            },
          },
        },
        `stock:detail:${code}`,
        60 // 1분 캐시
      );
      tracker.step('MarketCap 및 최신 가격 데이터 조회 완료');

      // 최신 가격 데이터에서 high, low, open 가져오기
      const latestPrice = stockRecord?.prices?.[0];
      const high = latestPrice?.high ? Number(latestPrice.high) : stock.currentPrice;
      const low = latestPrice?.low ? Number(latestPrice.low) : stock.currentPrice;
      const open = latestPrice?.open ? Number(latestPrice.open) : stock.currentPrice;

      tracker.step('응답 DTO 생성');
      const detail = {
        currentPrice: stock.currentPrice,
        change: stock.change,
        changePercent: stock.changeRate,
        volume: Number(stock.volume),
        high,
        low,
        open,
        marketCap: stockRecord?.marketCap ? Number(stockRecord.marketCap) : 0,
      };

      const result = StockDetailResponseDto.fromDetail(
        stock.code,
        stock.name,
        stock.market,
        detail,
        chartData
      );
      tracker.finish();
      return result;
    }

    // DB에도 없고 네이버 API도 실패한 경우
    tracker.finish();
    return null;
  }

  getCategories(): string[] {
    return Object.keys(POPULAR_STOCKS);
  }

  private localSearch(query: string): StockResponseDto[] {
    const allStocks = Object.values(POPULAR_STOCKS).flat();
    const uniqueStocks = allStocks.filter(
      (stock, index, self) => self.findIndex((s) => s.code === stock.code) === index
    );

    const results = uniqueStocks.filter(
      (stock) =>
        stock.name.toLowerCase().includes(query.toLowerCase()) || stock.code.includes(query)
    );

    return results.slice(0, 10).map((stock, index) => {
      const basePrice = 50000;
      const changePercent = (Math.random() - 0.5) * 6;
      const change = Math.round((basePrice * changePercent) / 100);

      return StockResponseDto.to({
        id: `local-${index}`,
        code: stock.code,
        name: stock.name,
        market: stock.market,
        sector: stock.sector,
        currentPrice: basePrice + change,
        change,
        changeRate: Number(changePercent.toFixed(2)),
        volume: Math.floor(Math.random() * 5000000) + 500000,
      });
    });
  }
}
