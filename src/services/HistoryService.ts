import { IHistoryFacade } from '../facades/IHistoryFacade';
import { IHistoryRepository } from '../repositories/IHistoryRepository';
import { IStockRepository } from '../repositories/IStockRepository';
import { HistoryResponseDto } from '../dto/history/HistoryResponseDto';
import { CreateHistoryDto } from '../dto/history/CreateHistoryDto';
import { History } from '../entities/History';
import { NotFoundError } from '../errors/AppError';
import { logger } from '../config/logger';
import { executeTransaction, TRANSACTION_TIMEOUT } from '../utils/transaction';
import { StockRepositoryAdapter } from '../adapters/StockRepositoryAdapter';
import { HistoryRepositoryAdapter } from '../adapters/HistoryRepositoryAdapter';
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

export class HistoryService implements IHistoryFacade {
  constructor(
    private readonly historyRepository: IHistoryRepository,
    private readonly stockRepository: IStockRepository
  ) {}

  async getHistory(userId: string, limit: number = 20, offset: number = 0): Promise<{
    data: HistoryResponseDto[];
    total: number;
  }> {
    const tracker = createStepTracker('HistoryService.getHistory');
    
    tracker.step('History 조회 시작');
    const result = await this.historyRepository.findAll(userId, limit, offset);
    tracker.step('History 조회 완료');

    tracker.step('Stock ID 추출');
    const stockIds = result.data.map((h) => h.stockId);
    
    tracker.step('Stock 조회 시작');
    const stocks = await this.stockRepository.findMany(stockIds);
    tracker.step('Stock 조회 완료');
    
    tracker.step('Stock Map 생성');
    const stockMap = new Map(stocks.map((s) => [s.id, s]));

    tracker.step('DTO 변환 시작');
    const data = result.data.map((history) => {
      const stock = stockMap.get(history.stockId);
      if (!stock) {
        throw new NotFoundError(`Stock for history ${history.id}`);
      }
      return HistoryResponseDto.to(history, stock);
    });
    tracker.step('DTO 변환 완료');
    
    tracker.finish();
    return { data, total: result.total };
  }

  /**
   * 히스토리 추가 (트랜잭션 적용)
   * 
   * 트랜잭션이 필요한 이유:
   * 1. Stock 조회와 History 생성이 원자적으로 처리되어야 함
   *    - Stock 존재 확인 후 History 생성
   *    - 데이터 일관성 보장 (ACID 원칙)
   * 
   * 2. 최근 기록 조회와 생성이 원자적으로 처리되어야 함
   *    - 동시 요청 시 중복 기록 방지
   *    - Race Condition 방지
   * 
   * 3. 외래 키 제약 조건 만족
   *    - History는 항상 유효한 Stock을 참조해야 함
   */
  async addHistory(userId: string, dto: CreateHistoryDto): Promise<HistoryResponseDto> {
    const tracker = createStepTracker('HistoryService.addHistory');
    
    tracker.step('트랜잭션 시작');
    return await executeTransaction(
      async (tx) => {
        tracker.step('Repository 인스턴스 생성');
        const stockRepoWithTx = StockRepositoryAdapter.withTransaction(tx);
        const historyRepoWithTx = HistoryRepositoryAdapter.withTransaction(tx);

        tracker.step('Stock 조회 시작');
        const stockResult = await findStockByIdOrCode(stockRepoWithTx, dto.stockId);
        if (!stockResult) {
          throw new NotFoundError(`Stock not found: ${dto.stockId}`);
        }
        const { id: actualStockId, stock } = stockResult;
        tracker.step('Stock 조회 완료');

        tracker.step('최근 기록 조회 시작');
        const hours = dto.type === 'search' ? 5 / 60 : 1; // 검색은 5분, 조회는 1시간
        const recent = await historyRepoWithTx.findByUserAndStock(
          userId,
          actualStockId,
          hours
        );
        tracker.step('최근 기록 조회 완료');

        // 같은 타입의 최근 기록이 있으면 업데이트하지 않고 반환
        if (recent && recent.type === dto.type) {
          logger.debug(`Recent history found for user ${userId}, stockId: ${actualStockId}, type: ${dto.type}`);
          tracker.finish();
          return HistoryResponseDto.to(recent, stock);
        }

        tracker.step('History 생성 시작');
        const history = new History('', userId, actualStockId, dto.type, new Date());
        const created = await historyRepoWithTx.create(history);
        tracker.step('History 생성 완료');

        logger.info(`History added: ${created.id} for user ${userId}, type: ${dto.type}, stockId: ${actualStockId}`);
        tracker.finish();

        return HistoryResponseDto.to(created, stock);
      },
      TRANSACTION_TIMEOUT.DEFAULT
    );
  }

  async clearHistory(userId: string): Promise<void> {
    await this.historyRepository.deleteAll(userId);
    logger.info(`History cleared for user ${userId}`);
  }

  async findRecent(userId: string, stockId: string, timeWindow: number): Promise<HistoryResponseDto | null> {
    // stockId 또는 code로 Stock 조회
    const stockResult = await findStockByIdOrCode(this.stockRepository, stockId);
    if (!stockResult) {
      return null;
    }
    const { id: actualStockId, stock } = stockResult;

    // timeWindow를 시간으로 변환 (밀리초 -> 시간)
    const hours = timeWindow / (1000 * 60 * 60);
    const recent = await this.historyRepository.findByUserAndStock(userId, actualStockId, hours);
    
    if (!recent) {
      return null;
    }

    return HistoryResponseDto.to(recent, stock);
  }
}

