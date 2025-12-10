import { FastifyRequest, FastifyReply } from 'fastify';
import { UserActivityService } from '../services/UserActivityService';
import { parseQueryInt } from '../utils/query';
import { PAGINATION } from '../constants/pagination';
import { NotFoundError } from '../errors/AppError';

export class UserActivityController {
  constructor(private readonly userActivityService: UserActivityService) {}

  /**
   * 뉴스 읽기 기록
   */
  async trackNewsRead(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const { newsId } = request.params as { newsId: string };

    await this.userActivityService.trackNewsRead(userId, newsId);

    reply.status(201).send({
      success: true,
      message: 'News read tracked successfully',
    });
  }

  /**
   * 뉴스 좋아요 토글
   */
  async toggleNewsLike(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const { newsId } = request.params as { newsId: string };

    const isLiked = await this.userActivityService.toggleNewsLike(userId, newsId);

    reply.send({
      success: true,
      data: { isLiked },
      message: isLiked ? 'News liked' : 'News unliked',
    });
  }

  /**
   * 뉴스 즐겨찾기 토글
   */
  async toggleNewsFavorite(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const { newsId } = request.params as { newsId: string };

    const isFavorite = await this.userActivityService.toggleNewsFavorite(userId, newsId);

    reply.send({
      success: true,
      data: { isFavorite },
      message: isFavorite ? 'News favorited' : 'News unfavorited',
    });
  }

  /**
   * 사용자 활동 정보 조회 (챗봇 컨텍스트용)
   */
  async getUserContext(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;

    const context = await this.userActivityService.getUserContext(userId);

    reply.send({
      success: true,
      data: context,
    });
  }

  /**
   * 읽은 뉴스 목록 조회
   */
  async getReadNews(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const query = request.query as { limit?: string };
    const limit = parseQueryInt(query.limit, PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MIN_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
    const newsIds = await this.userActivityService.getReadNews(userId, limit);

    reply.send({
      success: true,
      data: newsIds,
      meta: {
        total: newsIds.length,
        limit,
        offset: 0,
        hasMore: false,
      },
    });
  }

  /**
   * 좋아요한 뉴스 목록 조회
   */
  async getLikedNews(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const query = request.query as { limit?: string };
    const limit = parseQueryInt(query.limit, PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MIN_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
    const newsIds = await this.userActivityService.getLikedNews(userId, limit);

    reply.send({
      success: true,
      data: newsIds,
      meta: {
        total: newsIds.length,
        limit,
        offset: 0,
        hasMore: false,
      },
    });
  }

  /**
   * 즐겨찾기한 뉴스 목록 조회
   */
  async getFavoriteNews(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const query = request.query as { limit?: string };
    const limit = parseQueryInt(query.limit, PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MIN_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
    const newsIds = await this.userActivityService.getFavoriteNews(userId, limit);

    reply.send({
      success: true,
      data: newsIds,
      meta: {
        total: newsIds.length,
        limit,
        offset: 0,
        hasMore: false,
      },
    });
  }
}

