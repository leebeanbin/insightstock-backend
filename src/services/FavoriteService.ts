import { IFavoriteFacade } from '../facades/IFavoriteFacade';
import { IFavoriteRepository } from '../repositories/IFavoriteRepository';
import { IStockRepository } from '../repositories/IStockRepository';
import { FavoriteResponseDto } from '../dto/favorite/FavoriteResponseDto';
import { CreateFavoriteDto } from '../dto/favorite/CreateFavoriteDto';
import { Favorite } from '../entities/Favorite';
import { Stock } from '../entities/Stock';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { logger } from '../config/logger';
import { executeTransaction, TRANSACTION_TIMEOUT } from '../utils/transaction';
import { Prisma } from '@prisma/client';
import { StockRepositoryAdapter } from '../adapters/StockRepositoryAdapter';
import { FavoriteRepositoryAdapter } from '../adapters/FavoriteRepositoryAdapter';
import { withMetrics, createStepTracker } from '../utils/aop';

// UUID 형식 체크 헬퍼 함수
const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// stockId 또는 code로 Stock 조회
const findStockByIdOrCode = async (
  stockRepository: IStockRepository,
  identifier: string
): Promise<{ id: string; stock: Stock } | null> => {
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

export class FavoriteService implements IFavoriteFacade {
  constructor(
    private readonly favoriteRepository: IFavoriteRepository,
    private readonly stockRepository: IStockRepository
  ) {}

  async getFavorites(userId: string): Promise<FavoriteResponseDto[]> {
    const tracker = createStepTracker('FavoriteService.getFavorites');
    
    tracker.step('Favorite 조회 시작');
    const favorites = await this.favoriteRepository.findAll(userId);
    tracker.step('Favorite 조회 완료');

    // favorites가 없으면 빈 배열 반환
    if (favorites.length === 0) {
      tracker.finish();
      return [];
    }

    tracker.step('Stock ID 추출');
    const stockIds = favorites.map((f) => f.stockId);
    
    tracker.step('Stock 조회 시작');
    const stocks = await this.stockRepository.findMany(stockIds);
    tracker.step('Stock 조회 완료');
    
    tracker.step('Stock Map 생성');
    const stockMap = new Map(stocks.map((s) => [s.id, s]));

    tracker.step('DTO 변환 시작');
    const result = favorites
      .map((favorite) => {
        const stock = stockMap.get(favorite.stockId);
        if (!stock) {
          logger.warn(`Stock not found for favorite ${favorite.id}, stockId: ${favorite.stockId}`);
          return null;
        }
        return FavoriteResponseDto.to(favorite, stock);
      })
      .filter((dto): dto is FavoriteResponseDto => dto !== null);
    tracker.step('DTO 변환 완료');
    
    tracker.finish();
    return result;
  }

  /**
   * 즐겨찾기 추가 (트랜잭션 적용)
   * 
   * 트랜잭션이 필요한 이유:
   * 1. Stock 조회와 Favorite 생성이 원자적으로 처리되어야 함
   *    - Stock이 존재하는지 확인한 후 Favorite 생성
   *    - 중간에 Stock이 삭제되면 Favorite 생성 실패해야 함
   *    - 데이터베이스 일관성 보장 (ACID 원칙)
   * 
   * 2. 중복 체크와 생성이 원자적으로 처리되어야 함
   *    - 동시 요청 시 Race Condition 방지
   *    - Unique 제약 조건 위반 방지 (userId_stockId)
   *    - Isolation Level에 따라 동시성 제어
   * 
   * 3. 데이터 일관성 보장
   *    - Favorite는 항상 유효한 Stock을 참조해야 함
   *    - 외래 키 제약 조건 만족 (Foreign Key Constraint)
   *    - 트랜잭션 롤백 시 모든 변경사항 취소
   * 
   * 4. 성능 최적화
   *    - 단일 트랜잭션으로 여러 쿼리 실행
   *    - 데이터베이스 연결 오버헤드 감소
   */
  async addFavorite(userId: string, dto: CreateFavoriteDto): Promise<FavoriteResponseDto> {
    const tracker = createStepTracker('FavoriteService.addFavorite');
    
    tracker.step('트랜잭션 시작');
    return await executeTransaction(
      async (tx) => {
        tracker.step('Repository 인스턴스 생성');
        const stockRepoWithTx = StockRepositoryAdapter.withTransaction(tx);
        const favoriteRepoWithTx = FavoriteRepositoryAdapter.withTransaction(tx);

        tracker.step('Stock 조회 시작');
        const stockResult = await findStockByIdOrCode(stockRepoWithTx, dto.stockId);
        if (!stockResult) {
          throw new NotFoundError(`Stock not found: ${dto.stockId}`);
        }
        const { id: actualStockId, stock } = stockResult;
        tracker.step('Stock 조회 완료');

        tracker.step('중복 체크 시작');
        const existing = await favoriteRepoWithTx.findByUserAndStock(userId, actualStockId);
        if (existing) {
          throw new ConflictError('Stock already in favorites');
        }
        tracker.step('중복 체크 완료');

        tracker.step('Favorite 생성 시작');
        const favorite = new Favorite('', userId, actualStockId, new Date());
        const created = await favoriteRepoWithTx.create(favorite);
        tracker.step('Favorite 생성 완료');

        logger.info(`Favorite added: ${created.id} for user ${userId}`);
        tracker.finish();

        return FavoriteResponseDto.to(created, stock);
      },
      TRANSACTION_TIMEOUT.DEFAULT
    );
  }

  async removeFavorite(id: string, userId: string): Promise<void> {
    const tracker = createStepTracker('FavoriteService.removeFavorite');
    
    tracker.step('Favorite 조회 시작');
    const existing = await this.favoriteRepository.findById(id, userId);
    if (!existing) {
      throw new NotFoundError('Favorite');
    }
    tracker.step('Favorite 조회 완료');

    tracker.step('Favorite 삭제 시작');
    await this.favoriteRepository.delete(id);
    tracker.step('Favorite 삭제 완료');

    logger.info(`Favorite removed: ${id}`);
    tracker.finish();
  }

  async isFavorited(userId: string, stockId: string): Promise<boolean> {
    const tracker = createStepTracker('FavoriteService.isFavorited');
    
    tracker.step('Stock 조회 시작');
    const stockResult = await findStockByIdOrCode(this.stockRepository, stockId);
    if (!stockResult) {
      tracker.finish();
      return false;
    }
    const { id: actualStockId } = stockResult;
    tracker.step('Stock 조회 완료');

    tracker.step('Favorite 조회 시작');
    const favorite = await this.favoriteRepository.findByUserAndStock(userId, actualStockId);
    tracker.step('Favorite 조회 완료');
    
    tracker.finish();
    return !!favorite;
  }
}
