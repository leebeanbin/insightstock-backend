import { FastifyPluginAsync } from 'fastify';
import { FavoriteController } from '../controllers/FavoriteController';
import { FavoriteService } from '../services/FavoriteService';
import { FavoriteRepositoryAdapter } from '../adapters/FavoriteRepositoryAdapter';
import { StockRepositoryAdapter } from '../adapters/StockRepositoryAdapter';
import { authenticate } from '../middlewares/auth';

// Dependency Injection
const favoriteRepository = new FavoriteRepositoryAdapter();
const stockRepository = new StockRepositoryAdapter();
const favoriteFacade = new FavoriteService(favoriteRepository, stockRepository);
const favoriteController = new FavoriteController(favoriteFacade);

const routes: FastifyPluginAsync = async (fastify) => {
  // Auth hook for all routes
  fastify.addHook('onRequest', authenticate);

  fastify.get('/', async (request, reply) => {
    await favoriteController.getFavorites(request, reply);
  });

  fastify.post('/', async (request, reply) => {
    await favoriteController.addFavorite(request, reply);
  });

  fastify.delete('/:id', async (request, reply) => {
    await favoriteController.removeFavorite(request, reply);
  });

  fastify.get('/check/:stockId', async (request, reply) => {
    await favoriteController.checkFavorite(request, reply);
  });
};

export default routes;
