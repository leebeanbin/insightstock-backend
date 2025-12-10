import { FastifyPluginAsync } from 'fastify';
import { PortfolioController } from '../controllers/PortfolioController';
import { PortfolioService } from '../services/PortfolioService';
import { PortfolioRepositoryAdapter } from '../adapters/PortfolioRepositoryAdapter';
import { StockRepositoryAdapter } from '../adapters/StockRepositoryAdapter';
import { authenticate } from '../middlewares/auth';

// Dependency Injection
const portfolioRepository = new PortfolioRepositoryAdapter();
const stockRepository = new StockRepositoryAdapter();
const portfolioFacade = new PortfolioService(portfolioRepository, stockRepository);
const portfolioController = new PortfolioController(portfolioFacade);

const routes: FastifyPluginAsync = async (fastify) => {
  // Auth hook for all routes
  fastify.addHook('onRequest', authenticate);

  fastify.get('/', async (request, reply) => {
    await portfolioController.getPortfolios(request, reply);
  });

  // Specific routes must come before parameterized routes
  fastify.get('/analysis', async (request, reply) => {
    await portfolioController.getAnalysis(request, reply);
  });

  fastify.get('/stock/:stockId', async (request, reply) => {
    await portfolioController.getPortfolioByStockId(request, reply);
  });

  // Parameterized route (:id) must come last
  fastify.get('/:id', async (request, reply) => {
    await portfolioController.getPortfolioById(request, reply);
  });

  fastify.post('/', async (request, reply) => {
    await portfolioController.createPortfolio(request, reply);
  });

  fastify.put('/:id', async (request, reply) => {
    await portfolioController.updatePortfolio(request, reply);
  });

  fastify.delete('/:id', async (request, reply) => {
    await portfolioController.deletePortfolio(request, reply);
  });
};

export default routes;
