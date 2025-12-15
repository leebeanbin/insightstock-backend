import { FastifyPluginAsync } from 'fastify';
import { FolioController } from '../controllers/FolioController';
import { FolioService } from '../services/FolioService';
import { authenticate } from '../middlewares/auth';

// Dependency Injection
const folioService = new FolioService();
const folioController = new FolioController(folioService);

const routes: FastifyPluginAsync = async (fastify) => {
  // 모든 라우트는 인증 필요
  fastify.addHook('onRequest', authenticate);

  // Folio 통계 조회 (5분 캐시 - 통계는 자주 변경되지 않음)
  fastify.get('/stats', {
    preHandler: (fastify as any).cache(300),
  }, async (request, reply) => {
    await folioController.getStats(request, reply);
  });

  // 필터링된 노트 목록 조회 (1분 캐시)
  fastify.get('/notes', {
    preHandler: (fastify as any).cache(60),
  }, async (request, reply) => {
    await folioController.getFilteredNotes(request, reply);
  });
};

export default routes;


