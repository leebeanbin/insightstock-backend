import { FastifyPluginAsync } from 'fastify';
import { LearningController } from '../controllers/LearningController';
import { authenticate } from '../middlewares/auth';

const learningController = new LearningController();

const routes: FastifyPluginAsync = async (fastify) => {
  // 모든 라우트는 인증 필요
  fastify.addHook('onRequest', authenticate);

  // 학습 Q&A 목록 조회
  fastify.get('/', async (request, reply) => {
    await learningController.getLearningQAs(request, reply);
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

