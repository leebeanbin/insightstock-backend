import { FastifyPluginAsync } from 'fastify';
import { UserActivityController } from '../controllers/UserActivityController';
import { UserActivityService } from '../services/UserActivityService';
import { authenticate } from '../middlewares/auth';

// Dependency Injection
const userActivityService = new UserActivityService();
const userActivityController = new UserActivityController(userActivityService);

const routes: FastifyPluginAsync = async (fastify) => {
  // 모든 라우트는 인증 필요
  fastify.addHook('onRequest', authenticate);

  // 뉴스 읽기 기록
  fastify.post('/news/:newsId/read', async (request, reply) => {
    await userActivityController.trackNewsRead(request, reply);
  });

  // 뉴스 좋아요 토글
  fastify.post('/news/:newsId/like', async (request, reply) => {
    await userActivityController.toggleNewsLike(request, reply);
  });

  // 뉴스 즐겨찾기 토글
  fastify.post('/news/:newsId/favorite', async (request, reply) => {
    await userActivityController.toggleNewsFavorite(request, reply);
  });

  // 사용자 컨텍스트 조회 (챗봇용)
  fastify.get('/context', async (request, reply) => {
    await userActivityController.getUserContext(request, reply);
  });

  // 읽은 뉴스 목록
  fastify.get('/news/read', async (request, reply) => {
    await userActivityController.getReadNews(request, reply);
  });

  // 좋아요한 뉴스 목록
  fastify.get('/news/liked', async (request, reply) => {
    await userActivityController.getLikedNews(request, reply);
  });

  // 즐겨찾기한 뉴스 목록
  fastify.get('/news/favorites', async (request, reply) => {
    await userActivityController.getFavoriteNews(request, reply);
  });
};

export default routes;

