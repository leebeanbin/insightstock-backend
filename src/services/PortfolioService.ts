import { IPortfolioFacade, PortfolioAnalysis } from '../facades/IPortfolioFacade';
import { IPortfolioRepository } from '../repositories/IPortfolioRepository';
import { IStockRepository } from '../repositories/IStockRepository';
import { PortfolioResponseDto } from '../dto/portfolio/PortfolioResponseDto';
import { CreatePortfolioDto } from '../dto/portfolio/CreatePortfolioDto';
import { UpdatePortfolioDto } from '../dto/portfolio/UpdatePortfolioDto';
import { Portfolio } from '../entities/Portfolio';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { logger } from '../config/logger';
import { executeTransaction, TRANSACTION_TIMEOUT } from '../utils/transaction';
import { StockRepositoryAdapter } from '../adapters/StockRepositoryAdapter';
import { PortfolioRepositoryAdapter } from '../adapters/PortfolioRepositoryAdapter';
import { createStepTracker } from '../utils/aop';

// UUID 형식 체크 헬퍼 함수
const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// stockId 또는 code로 Stock 조회
const findStockByIdOrCode = async (
  stockRepository: IStockRepository,
  identifier: string
): Promise<{ id: string; stock: any } | null> => {
  // UUID 형식이면 findById 사용
  if (isUUID(identifier)) {
    const stock = await stockRepository.findById(identifier);
    if (stock) {
      return { id: stock.id, stock };
    }
  }
  
  // UUID가 아니거나 findById가 실패하면 code로 조회 시도
  const stock = await stockRepository.findByCode(identifier);
  if (stock) {
    return { id: stock.id, stock };
  }
  
  return null;
};

export class PortfolioService implements IPortfolioFacade {
  constructor(
    private readonly portfolioRepository: IPortfolioRepository,
    private readonly stockRepository: IStockRepository
  ) {}

  async getPortfolios(userId: string): Promise<PortfolioResponseDto[]> {
    const tracker = createStepTracker('PortfolioService.getPortfolios');
    
    tracker.step('Portfolio 조회 시작');
    const portfolios = await this.portfolioRepository.findAll(userId);
    tracker.step('Portfolio 조회 완료');

    tracker.step('Stock ID 추출');
    const stockIds = portfolios.map(p => p.stockId);
    
    tracker.step('Stock 조회 시작');
    const stocks = await this.stockRepository.findMany(stockIds);
    tracker.step('Stock 조회 완료');
    
    tracker.step('Stock Map 생성');
    const stockMap = new Map(stocks.map(s => [s.id, s]));

    tracker.step('DTO 변환 시작');
    const result = portfolios.map(portfolio => {
      const stock = stockMap.get(portfolio.stockId);
      if (!stock) {
        throw new NotFoundError(`Stock for portfolio ${portfolio.id}`);
      }
      return PortfolioResponseDto.to(portfolio, stock);
    });
    tracker.step('DTO 변환 완료');
    
    tracker.finish();
    return result;
  }

  async getPortfolioById(id: string, userId: string): Promise<PortfolioResponseDto | null> {
    const tracker = createStepTracker('PortfolioService.getPortfolioById');
    
    tracker.step('Portfolio 조회 시작');
    const portfolio = await this.portfolioRepository.findById(id, userId);
    if (!portfolio) {
      tracker.finish();
      return null;
    }
    tracker.step('Portfolio 조회 완료');

    tracker.step('Stock 조회 시작');
    const stock = await this.stockRepository.findById(portfolio.stockId);
    if (!stock) {
      throw new NotFoundError(`Stock for portfolio ${portfolio.id}`);
    }
    tracker.step('Stock 조회 완료');
    
    tracker.finish();
    return PortfolioResponseDto.to(portfolio, stock);
  }

  async getPortfolioByStockId(userId: string, stockId: string): Promise<PortfolioResponseDto | null> {
    const tracker = createStepTracker('PortfolioService.getPortfolioByStockId');
    
    tracker.step('Stock 조회 시작');
    const stockResult = await findStockByIdOrCode(this.stockRepository, stockId);
    if (!stockResult) {
      tracker.finish();
      return null;
    }
    const { id: actualStockId } = stockResult;
    tracker.step('Stock 조회 완료');
    
    tracker.step('Portfolio 조회 시작');
    const portfolio = await this.portfolioRepository.findByUserAndStock(userId, actualStockId);
    if (!portfolio) {
      tracker.finish();
      return null;
    }
    tracker.step('Portfolio 조회 완료');

    tracker.step('Stock 재조회 시작');
    const stock = await this.stockRepository.findById(portfolio.stockId);
    if (!stock) {
      throw new NotFoundError(`Stock for portfolio ${portfolio.id}`);
    }
    tracker.step('Stock 재조회 완료');
    
    tracker.finish();
    return PortfolioResponseDto.to(portfolio, stock);
  }

  /**
   * 포트폴리오 생성 (트랜잭션 적용)
   * 
   * 트랜잭션이 필요한 이유:
   * 1. 중복 체크, Stock 조회, Portfolio 생성이 원자적으로 처리되어야 함
   *    - 동시 요청 시 Race Condition 방지
   *    - Unique 제약 조건 위반 방지 (userId_stockId)
   * 
   * 2. 데이터 일관성 보장
   *    - Portfolio는 항상 유효한 Stock을 참조해야 함
   *    - Stock의 currentPrice를 기반으로 계산된 값들이 일관성 있게 저장되어야 함
   */
  async createPortfolio(userId: string, dto: CreatePortfolioDto): Promise<PortfolioResponseDto> {
    const tracker = createStepTracker('PortfolioService.createPortfolio');
    
    tracker.step('트랜잭션 시작');
    return await executeTransaction(
      async (tx) => {
        tracker.step('Repository 인스턴스 생성');
        const portfolioRepoWithTx = PortfolioRepositoryAdapter.withTransaction(tx);
        const stockRepoWithTx = StockRepositoryAdapter.withTransaction(tx);

        tracker.step('Stock 조회 시작');
        // stockId가 UUID가 아니면 code로 조회
        const stockResult = await findStockByIdOrCode(stockRepoWithTx, dto.stockId);
        if (!stockResult) {
          throw new NotFoundError(`Stock not found: ${dto.stockId}`);
        }
        const { id: actualStockId, stock } = stockResult;
        tracker.step('Stock 조회 완료');

        tracker.step('중복 체크 시작');
        // 트랜잭션 내에서 중복 체크 (동시성 제어)
        const existing = await portfolioRepoWithTx.findByUserAndStock(userId, actualStockId);
        if (existing) {
          throw new ConflictError('Portfolio entry for this stock already exists');
        }
        tracker.step('중복 체크 완료');

        tracker.step('Portfolio 생성 시작');
        // 트랜잭션 내에서 Portfolio 생성
        const portfolio = Portfolio.create({
          id: '',  // Will be generated by DB
          userId,
          stockId: actualStockId, // 실제 Stock UUID 사용
          quantity: dto.quantity,
          averagePrice: dto.averagePrice,
          currentPrice: stock.currentPrice,
        });

        const created = await portfolioRepoWithTx.create(portfolio);
        tracker.step('Portfolio 생성 완료');

        logger.info(`Portfolio created: ${created.id} for user ${userId}`);
        tracker.finish();

        return PortfolioResponseDto.to(created, stock);
      },
      TRANSACTION_TIMEOUT.DEFAULT
    );
  }

  /**
   * 포트폴리오 업데이트 (트랜잭션 적용)
   * 
   * 트랜잭션이 필요한 이유:
   * 1. Portfolio 조회, Stock 조회, Portfolio 업데이트가 원자적으로 처리되어야 함
   *    - Stock의 currentPrice가 변경되는 동안 일관성 보장
   *    - 계산된 값들(profit, profitRate 등)이 올바른 Stock 가격 기반으로 저장되어야 함
   * 
   * 2. 동시성 제어
   *    - 여러 요청이 동시에 Portfolio를 업데이트할 때 데이터 일관성 보장
   */
  async updatePortfolio(id: string, userId: string, dto: UpdatePortfolioDto): Promise<PortfolioResponseDto> {
    const tracker = createStepTracker('PortfolioService.updatePortfolio');
    
    tracker.step('트랜잭션 시작');
    return await executeTransaction(
      async (tx) => {
        tracker.step('Repository 인스턴스 생성');
        const portfolioRepoWithTx = PortfolioRepositoryAdapter.withTransaction(tx);
        const stockRepoWithTx = StockRepositoryAdapter.withTransaction(tx);

        tracker.step('Portfolio 조회 시작');
        // 트랜잭션 내에서 Portfolio 조회
        const existing = await portfolioRepoWithTx.findById(id, userId);
        if (!existing) {
          throw new NotFoundError('Portfolio');
        }
        tracker.step('Portfolio 조회 완료');

        tracker.step('Stock 조회 시작');
        // 트랜잭션 내에서 Stock 조회
        const stock = await stockRepoWithTx.findById(existing.stockId);
        if (!stock) {
          throw new NotFoundError('Stock');
        }
        tracker.step('Stock 조회 완료');

        tracker.step('수익 계산 시작');
        // 계산된 값들
        const quantity = dto.quantity ?? existing.quantity;
        const averagePrice = dto.averagePrice ?? existing.averagePrice;
        const totalCost = quantity * averagePrice;
        const currentValue = quantity * stock.currentPrice;
        const profit = currentValue - totalCost;
        const profitRate = totalCost > 0 ? (profit / totalCost) * 100 : 0;
        tracker.step('수익 계산 완료');

        tracker.step('Portfolio 업데이트 시작');
        // 트랜잭션 내에서 Portfolio 업데이트
        const updated = await portfolioRepoWithTx.update(id, {
          quantity,
          averagePrice,
          totalCost,
          currentValue,
          profit,
          profitRate,
        });
        tracker.step('Portfolio 업데이트 완료');

        logger.info(`Portfolio updated: ${id}`);
        tracker.finish();

        return PortfolioResponseDto.to(updated, stock);
      },
      TRANSACTION_TIMEOUT.DEFAULT
    );
  }

  async deletePortfolio(id: string, userId: string): Promise<void> {
    const tracker = createStepTracker('PortfolioService.deletePortfolio');
    
    tracker.step('Portfolio 조회 시작');
    const existing = await this.portfolioRepository.findById(id, userId);
    if (!existing) {
      throw new NotFoundError('Portfolio');
    }
    tracker.step('Portfolio 조회 완료');

    tracker.step('Portfolio 삭제 시작');
    await this.portfolioRepository.delete(id);
    tracker.step('Portfolio 삭제 완료');

    logger.info(`Portfolio deleted: ${id}`);
    tracker.finish();
  }

  async getAnalysis(userId: string): Promise<PortfolioAnalysis> {
    const tracker = createStepTracker('PortfolioService.getAnalysis');
    
    try {
      tracker.step('Portfolio 조회 시작');
      const portfolios = await this.portfolioRepository.findAll(userId);
      tracker.step('Portfolio 조회 완료');
      
      if (portfolios.length === 0) {
        tracker.finish();
        return {
          summary: {
            totalValue: 0,
            totalReturn: 0,
            returnRate: 0,
            riskScore: 0,
          },
          risks: [],
          diversification: {
            sectors: [],
          },
        };
      }

      tracker.step('Stock ID 추출');
      const stockIds = portfolios.map(p => p.stockId);
      
      tracker.step('Stock 조회 시작');
      const stocks = await this.stockRepository.findMany(stockIds);
      tracker.step('Stock 조회 완료');
      
      tracker.step('Stock Map 생성');
      const stockMap = new Map(stocks.map(s => [s.id, s]));

      tracker.step('포트폴리오 분석 계산 시작');
      // 총 가치 및 수익 계산
      let totalValue = 0;
      let totalCost = 0;
      let totalReturn = 0;

      const sectorMap = new Map<string, { value: number; count: number }>();

      for (const portfolio of portfolios) {
        const stock = stockMap.get(portfolio.stockId);
        if (!stock) continue;

        const currentValue = portfolio.quantity * stock.currentPrice;
        const cost = portfolio.quantity * portfolio.averagePrice;
        const profit = currentValue - cost;

        totalValue += currentValue;
        totalCost += cost;
        totalReturn += profit;

        // 섹터별 집계
        const sector = stock.sector || '기타';
        const existing = sectorMap.get(sector) || { value: 0, count: 0 };
        sectorMap.set(sector, {
          value: existing.value + currentValue,
          count: existing.count + 1,
        });
      }

      const returnRate = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;
      tracker.step('수익률 계산 완료');

      tracker.step('리스크 점수 계산 시작');
      // 리스크 점수 계산 (간단한 휴리스틱)
      const diversificationScore = sectorMap.size / Math.max(portfolios.length, 1);
      const concentrationRisk = portfolios.length < 5 ? 30 : 0;
      const riskScore = Math.max(0, Math.min(100, 100 - (diversificationScore * 20) - concentrationRisk));
      tracker.step('리스크 점수 계산 완료');

      tracker.step('리스크 분석 시작');
      // 리스크 분석
      const risks: PortfolioAnalysis['risks'] = [];

      // 집중도 리스크
      if (portfolios.length < 5) {
        risks.push({
          type: 'concentration',
          severity: 'warning',
          title: '포트폴리오 집중도',
          description: '보유 종목이 5개 미만입니다. 분산투자를 고려하세요.',
          value: portfolios.length,
          threshold: 5,
          recommendation: '다양한 섹터의 종목을 추가하여 리스크를 분산하세요.',
        });
      }

      // 섹터 집중도 리스크
      const maxSectorPercentage = Math.max(
        ...Array.from(sectorMap.values()).map(s => (s.value / totalValue) * 100)
      );
      if (maxSectorPercentage > 50) {
        risks.push({
          type: 'sector_concentration',
          severity: 'warning',
          title: '섹터 집중도',
          description: `한 섹터에 ${maxSectorPercentage.toFixed(1)}% 이상 투자하고 있습니다.`,
          value: maxSectorPercentage,
          threshold: 50,
          recommendation: '다양한 섹터에 분산 투자하여 리스크를 줄이세요.',
        });
      }

      // 수익률 리스크
      if (returnRate < -10) {
        risks.push({
          type: 'negative_return',
          severity: 'error',
          title: '마이너스 수익률',
          description: `현재 수익률이 ${returnRate.toFixed(2)}%로 마이너스입니다.`,
          value: returnRate,
          threshold: 0,
          recommendation: '포트폴리오 재검토 및 리밸런싱을 고려하세요.',
        });
      } else if (returnRate < 0) {
        risks.push({
          type: 'low_return',
          severity: 'info',
          title: '낮은 수익률',
          description: `현재 수익률이 ${returnRate.toFixed(2)}%입니다.`,
          value: returnRate,
          threshold: 0,
          recommendation: '포트폴리오 성과를 모니터링하세요.',
        });
      }

      tracker.step('섹터별 분산 정보 계산');
      // 섹터별 분산 정보
      const sectors = Array.from(sectorMap.entries()).map(([name, data]) => ({
        name,
        value: data.value,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      }));
      tracker.step('포트폴리오 분석 계산 완료');

      const result = {
        summary: {
          totalValue,
          totalReturn,
          returnRate,
          riskScore,
        },
        risks,
        diversification: {
          sectors,
        },
      };
      
      tracker.finish();
      return result;
    } catch (error) {
      logger.error('PortfolioService.getAnalysis error:', error);
      tracker.finish();
      throw error;
    }
  }
}
