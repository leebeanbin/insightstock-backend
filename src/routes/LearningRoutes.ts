import { FastifyPluginAsync } from 'fastify';
import { LearningController } from '../controllers/LearningController';
import { authenticate } from '../middlewares/auth';

const learningController = new LearningController();

const routes: FastifyPluginAsync = async (fastify) => {
  // 모든 라우트는 인증 필요
  fastify.addHook('onRequest', authenticate);

  // 학습 Q&A 목록 조회 (최적화: userId, concept, stockCode 필터 지원)
  fastify.get('/', async (request, reply) => {
    await learningController.getLearningQAs(request, reply);
  });

  // 학습 Q&A 생성 (단일)
  fastify.post('/', async (request, reply) => {
    await learningController.createLearning(request, reply);
  });

  // 학습 Q&A 배치 생성 (성능 최적화)
  fastify.post('/batch', async (request, reply) => {
    await learningController.createLearningsBatch(request, reply);
  });

  // 큐 통계 조회 (모니터링)
  fastify.get('/queue/stats', async (request, reply) => {
    try {
      const { getLearningQueueService } = await import('../services/LearningQueueService');
      const queueService = getLearningQueueService();
      const stats = await queueService.getQueueStats();
      
      reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to get queue stats',
      });
    }
  });

  // 학습 Q&A 상세 조회
  fastify.get('/:id', async (request, reply) => {
    await learningController.getLearningQAById(request, reply);
  });

  // 오늘의 학습 추천
  fastify.get('/today', async (request, reply) => {
    await learningController.getTodayRecommendations(request, reply);
  });
};

export default routes;

