import { FastifyRequest, FastifyReply } from 'fastify';
import { INewsFacade } from '../facades/INewsFacade';
import { NotFoundError } from '../errors/AppError';
import { parseQueryInt, parseQueryString } from '../utils/query';
import { PAGINATION } from '../constants/pagination';

export class NewsController {
  constructor(private readonly newsFacade: INewsFacade) {}

  async getNews(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as {
      stockCode?: string;
      limit?: string;
      offset?: string;
      sentiment?: string;
    };

    const limit = parseQueryInt(query.limit, PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MIN_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
    const offset = parseQueryInt(query.offset, 0, 0);

    const result = await this.newsFacade.getNews({
      stockCode: parseQueryString(query.stockCode),
      limit,
      offset,
      sentiment: parseQueryString(query.sentiment),
    });

    reply.send({
      success: true,
      data: result.data,
      meta: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.data.length < result.total,
      },
    });
  }

  async getNewsByStockCode(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { stockCode } = request.params as { stockCode: string };
    const query = request.query as { limit?: string };
    const limit = parseQueryInt(query.limit, PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MIN_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);

    const result = await this.newsFacade.getNewsByStockCode(stockCode, limit);

    reply.send({
      success: true,
      data: result.data,
      meta: {
        total: result.total,
        limit,
        offset: 0,
        hasMore: result.data.length < result.total,
      },
    });
  }

  async getNewsById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    const news = await this.newsFacade.getNewsById(id);

    if (!news) {
      throw new NotFoundError('News');
    }

    reply.send({
      success: true,
      data: news,
    });
  }
}

