import { FastifyRequest, FastifyReply } from 'fastify';
import { IStockFacade } from '../facades/IStockFacade';
import { IHistoryFacade } from '../facades/IHistoryFacade';
import { NotFoundError } from '../errors/AppError';
import { CreateHistoryDto } from '../dto/history/CreateHistoryDto';
import { logger } from '../config/logger';

export class StockController {
  constructor(
    private readonly stockFacade: IStockFacade,
    private readonly historyFacade?: IHistoryFacade
  ) {}

  async getStocks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { search, category, withPrice } = request.query as {
      search?: string;
      category?: string;
      withPrice?: string;
    };

    if (search) {
      const results = await this.stockFacade.searchStocks(search);
      
      // 검색 기록 저장 (인증된 사용자인 경우, 비동기로 처리하여 응답 지연 방지)
      if (request.userId && this.historyFacade && results.length > 0) {
        // 비동기로 처리하여 응답 지연 방지
        const userId = request.userId;
        const historyFacade = this.historyFacade;
        setImmediate(async () => {
          try {
            // 검색 결과의 첫 번째 종목에 대해 검색 기록 저장
            const firstResult = results[0];
            if (firstResult && firstResult.id && userId && historyFacade) {
              await historyFacade.addHistory(userId, new CreateHistoryDto(
                firstResult.id,
                'search' // 검색 타입
              ));
              logger.info(`Search history saved for user ${userId}, query: ${search}, stockId: ${firstResult.id}`);
            }
          } catch (error) {
            // 검색 기록 저장 실패해도 검색 결과는 반환 (로그만 기록)
            logger.warn(`Failed to save search history for user ${userId}, query: ${search}:`, error);
          }
        });
      }
      
      reply.send({
        success: true,
        data: results,
        meta: {
          query: search,
          count: results.length,
        },
      });
      return;
    }

    if (withPrice === 'true') {
      const cat = category || '인기';
      const stocks = await this.stockFacade.getStocksByCategory(cat);
      reply.send({
        success: true,
        data: stocks,
      });
      return;
    }

    const categories = this.stockFacade.getCategories();
    reply.send({
      success: true,
      data: categories,
    });
  }

  async getStockByCode(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { code } = request.params as { code: string };
    const { chart, period, interval, startDate, endDate } = request.query as { 
      chart?: string; 
      period?: string; 
      interval?: string;
      startDate?: string;
      endDate?: string;
    };

    const includeChart = chart === 'true';
    const chartPeriod = period ? parseInt(period) : 30;
    const chartInterval = interval || '1d'; // 1m, 5m, 15m, 30m, 1h, 1d
    const dateRange = startDate && endDate ? { start: startDate, end: endDate } : null;

    const stockDetail = await this.stockFacade.getStockByCode(
      code, 
      includeChart, 
      chartPeriod,
      chartInterval as string,
      dateRange
    );

    if (!stockDetail) {
      throw new NotFoundError('Stock');
    }

    reply.send({
      success: true,
      data: stockDetail,
    });
  }

  async getCategories(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const categories = this.stockFacade.getCategories();

    reply.send({
      success: true,
      data: categories,
    });
  }

  /**
   * 종목 차트 데이터 조회 (prices 엔드포인트)
   * GET /api/stocks/:code/prices?period=1m&interval=1d
   */
  async getStockPrices(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { code } = request.params as { code: string };
    const { period, interval } = request.query as {
      period?: string;
      interval?: string;
    };

    // period를 일(day) 수로 변환
    const periodMap: { [key: string]: number } = {
      '1d': 1,
      '1w': 7,
      '1m': 30,
      '3m': 90,
      '6m': 180,
      '1y': 365,
      '3y': 1095,
      '5y': 1825,
    };
    const chartPeriod = periodMap[period || '1m'] || 30;
    const chartInterval = interval || '1d';

    // getStockByCode의 chart 기능 활용
    const stockDetail = await this.stockFacade.getStockByCode(
      code,
      true, // includeChart
      chartPeriod,
      chartInterval,
      null
    );

    if (!stockDetail) {
      throw new NotFoundError('Stock');
    }

    // prices만 반환
    reply.send({
      success: true,
      data: {
        prices: stockDetail.chartData || [],
      },
    });
  }
}
