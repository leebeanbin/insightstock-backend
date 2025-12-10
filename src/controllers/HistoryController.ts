import { FastifyRequest, FastifyReply } from 'fastify';
import { IHistoryFacade } from '../facades/IHistoryFacade';
import { CreateHistoryDto } from '../dto/history/CreateHistoryDto';
import { BadRequestError } from '../errors/AppError';
import { parseQueryInt } from '../utils/query';
import { PAGINATION } from '../constants/pagination';

export class HistoryController {
  constructor(private readonly historyFacade: IHistoryFacade) {}

  async getHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const query = request.query as { limit?: string; offset?: string };
    const limit = parseQueryInt(query.limit, PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MIN_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
    const offset = parseQueryInt(query.offset, 0, 0);

    const result = await this.historyFacade.getHistory(userId, limit, offset);

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

  async addHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const dto = CreateHistoryDto.from(request.body);

    const history = await this.historyFacade.addHistory(userId, dto);

    reply.status(201).send({
      success: true,
      data: history,
    });
  }

  async clearHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;

    await this.historyFacade.clearHistory(userId);

    reply.send({
      success: true,
      message: 'History cleared successfully',
    });
  }

  async findRecent(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const query = request.query as { stockId?: string; newsId?: string; timeWindow?: string };
    
    // newsId가 오면 null 반환 (History는 stock에 대한 기록만 지원)
    if (query.newsId) {
      reply.status(200).send({
        success: true,
        data: null,
        message: 'No recent history found for news',
      });
      return;
    }

    if (!query.stockId) {
      throw new BadRequestError('stockId is required');
    }

    const timeWindow = query.timeWindow ? parseInt(query.timeWindow, 10) : 5 * 60 * 1000; // 기본 5분

    const recent = await this.historyFacade.findRecent(userId, query.stockId, timeWindow);

    if (!recent) {
      // 최근 기록이 없으면 404가 아니라 200으로 null 반환 (정상적인 경우)
      reply.status(200).send({
        success: true,
        data: null,
        message: 'No recent history found',
      });
      return;
    }

    reply.send({
      success: true,
      data: recent,
    });
  }
}
