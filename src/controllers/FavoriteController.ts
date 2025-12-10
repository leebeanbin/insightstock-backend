import { FastifyRequest, FastifyReply } from 'fastify';
import { IFavoriteFacade } from '../facades/IFavoriteFacade';
import { CreateFavoriteDto } from '../dto/favorite/CreateFavoriteDto';
import { ValidationError, UnauthorizedError } from '../errors/AppError';
import { logger } from '../config/logger';

export class FavoriteController {
  constructor(private readonly favoriteFacade: IFavoriteFacade) {}

  async getFavorites(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const favorites = await this.favoriteFacade.getFavorites(userId);

    // DTO를 JSON으로 직렬화
    const serializedFavorites = favorites.map(fav => fav.toJSON());

    reply.send({
      success: true,
      data: serializedFavorites,
    });
  }

  async addFavorite(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const dto = CreateFavoriteDto.from(request.body);

    const favorite = await this.favoriteFacade.addFavorite(userId, dto);

    reply.status(201).send({
      success: true,
      data: favorite,
    });
  }

  async removeFavorite(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const userId = request.userId!;

    await this.favoriteFacade.removeFavorite(id, userId);

    reply.send({
      success: true,
      message: 'Favorite removed successfully',
    });
  }

  async checkFavorite(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { stockId } = request.params as { stockId: string };
    const userId = request.userId!;

    const isFavorited = await this.favoriteFacade.isFavorited(userId, stockId);

    reply.send({
      success: true,
      data: { isFavorited },
    });
  }
}
