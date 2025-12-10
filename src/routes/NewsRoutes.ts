import { FastifyPluginAsync } from 'fastify';
import { NewsController } from '../controllers/NewsController';
import { NewsService } from '../services/NewsService';
import { NewsRepositoryAdapter } from '../adapters/NewsRepositoryAdapter';
import { logger } from '../config/logger';

// Dependency Injection
const newsRepository = new NewsRepositoryAdapter();
const newsFacade = new NewsService(newsRepository);
const newsController = new NewsController(newsFacade);

const routes: FastifyPluginAsync = async (fastify) => {
  // News routes don't require authentication

  // 뉴스 목록 조회 (5분 캐시 - 뉴스는 자주 변경되지 않음)
  fastify.get('/', {
    preHandler: (fastify as any).cache(300),
  }, async (request, reply) => {
    await newsController.getNews(request, reply);
  });

  // 종목별 뉴스 조회 (5분 캐시)
  fastify.get('/stock/:stockCode', {
    preHandler: (fastify as any).cache(300),
  }, async (request, reply) => {
    await newsController.getNewsByStockCode(request, reply);
  });

  // 뉴스 상세 조회 (10분 캐시 - 상세 내용은 자주 변경되지 않음)
  fastify.get('/:id', {
    preHandler: (fastify as any).cache(600),
  }, async (request, reply) => {
    await newsController.getNewsById(request, reply);
  });
};

export default routes;

