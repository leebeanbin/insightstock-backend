import { FastifyPluginAsync } from 'fastify';
import { HistoryController } from '../controllers/HistoryController';
import { HistoryService } from '../services/HistoryService';
import { HistoryRepositoryAdapter } from '../adapters/HistoryRepositoryAdapter';
import { StockRepositoryAdapter } from '../adapters/StockRepositoryAdapter';
import { authenticate } from '../middlewares/auth';

// Dependency Injection
const historyRepository = new HistoryRepositoryAdapter();
const stockRepository = new StockRepositoryAdapter();
const historyFacade = new HistoryService(historyRepository, stockRepository);
const historyController = new HistoryController(historyFacade);

const routes: FastifyPluginAsync = async (fastify) => {
  // Auth hook for all routes
  fastify.addHook('onRequest', authenticate);

  // More specific routes must be defined before general routes
  fastify.get('/recent', async (request, reply) => {
    await historyController.findRecent(request, reply);
  });

  fastify.get('/', async (request, reply) => {
    await historyController.getHistory(request, reply);
  });

  fastify.post('/', async (request, reply) => {
    await historyController.addHistory(request, reply);
  });

  fastify.delete('/', async (request, reply) => {
    await historyController.clearHistory(request, reply);
  });
};

export default routes;
