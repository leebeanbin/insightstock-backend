import { FastifyPluginAsync } from 'fastify';
import { SearchController } from '../controllers/SearchController';
import { SearchService } from '../services/SearchService';
import { optionalAuth } from '../middlewares/auth';

// Dependency Injection
const searchService = new SearchService();
const searchController = new SearchController(searchService);

const routes: FastifyPluginAsync = async (fastify) => {
  // 검색은 optional auth (검색 기록 저장을 위해)
  fastify.addHook('onRequest', optionalAuth);

  // 통합 검색
  fastify.get('/', async (request, reply) => {
    await searchController.search(request, reply);
  });

  // 종목 검색
  fastify.get('/stocks', async (request, reply) => {
    await searchController.searchStocks(request, reply);
  });

  // 뉴스 검색
  fastify.get('/news', async (request, reply) => {
    await searchController.searchNews(request, reply);
  });

  // 인기 검색어
  fastify.get('/popular', async (request, reply) => {
    await searchController.getPopularSearches(request, reply);
  });

  // 자동완성 제안
  fastify.get('/suggestions', async (request, reply) => {
    await searchController.getSuggestions(request, reply);
  });
};

export default routes;

