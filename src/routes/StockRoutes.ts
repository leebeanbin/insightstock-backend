import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { StockController } from '../controllers/StockController';
import { StockService } from '../services/StockService';
import { HistoryService } from '../services/HistoryService';
import { HistoryRepositoryAdapter } from '../adapters/HistoryRepositoryAdapter';
import { StockRepositoryAdapter } from '../adapters/StockRepositoryAdapter';
import { optionalAuth } from '../middlewares/auth';
// TODO: 실제 증권 API 연결 시 활성화
// import { NaverStockApiAdapter } from '../adapters/NaverStockApiAdapter';

// Zod 스키마 정의
const stockCodeSchema = z.object({
  code: z.string().length(6, 'Stock code must be 6 characters'),
});

const stockPricesSchema = z.object({
  code: z.string().length(6),
  period: z.string().optional(),
  interval: z.string().optional(),
});

// Dependency Injection
// TODO: 실제 증권 API 연결 시 활성화
// const naverApi = new NaverStockApiAdapter();
// const stockFacade = new StockService(naverApi);
const stockFacade = new StockService(/* naverApi */);
const historyRepository = new HistoryRepositoryAdapter();
const stockRepository = new StockRepositoryAdapter();
const historyFacade = new HistoryService(historyRepository, stockRepository);
const stockController = new StockController(stockFacade, historyFacade);

const routes: FastifyPluginAsync = async (fastify) => {
  // Stock routes - 검색은 optional auth (검색 기록 저장을 위해)
  fastify.addHook('onRequest', optionalAuth);
  
  // 주식 목록 조회 (1분 캐시)
  fastify.get('/', {
    preHandler: (fastify as any).cache(60),
  }, async (request, reply) => {
    await stockController.getStocks(request, reply);
  });

  // 카테고리 목록 (5분 캐시 - 자주 변경되지 않음)
  fastify.get('/categories', {
    preHandler: (fastify as any).cache(300),
  }, async (request, reply) => {
    await stockController.getCategories(request, reply);
  });

  // 차트 데이터 조회 (10초 캐시 - 실시간성 중요)
  fastify.get('/:code/prices', {
    preHandler: (fastify as any).cache(10),
  }, async (request, reply) => {
    // Zod 스키마 검증
    try {
      stockPricesSchema.parse({ code: (request.params as any).code });
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: (error as any).issues,
        });
        return;
      }
    }
    await stockController.getStockPrices(request, reply);
  });

  // 주식 상세 조회 (1분 캐시)
  fastify.get('/:code', {
    preHandler: (fastify as any).cache(60),
  }, async (request, reply) => {
    // Zod 스키마 검증
    try {
      stockCodeSchema.parse({ code: (request.params as any).code });
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: (error as any).issues,
        });
        return;
      }
    }
    await stockController.getStockByCode(request, reply);
  });
};

export default routes;
