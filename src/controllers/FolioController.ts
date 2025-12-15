import { FastifyRequest, FastifyReply } from 'fastify';
import { FolioService } from '../services/FolioService';
import { parseQueryInt } from '../utils/query';
import { PAGINATION } from '../constants/pagination';

export class FolioController {
  constructor(private readonly folioService: FolioService) {}

  /**
   * Folio 통계 조회
   */
  async getStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const stats = await this.folioService.getStats(userId);

    reply.send({
      success: true,
      data: stats,
    });
  }

  /**
   * 필터링된 노트 목록 조회
   */
  async getFilteredNotes(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const query = request.query as {
      tags?: string;
      stockCodes?: string;
      newsId?: string;
      hasHighlight?: string;
      startDate?: string;
      endDate?: string;
      limit?: string;
      offset?: string;
    };

    const limit = parseQueryInt(query.limit, PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MIN_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
    const offset = parseQueryInt(query.offset, 0, 0);

    const filters = {
      tags: query.tags ? query.tags.split(',') : undefined,
      stockCodes: query.stockCodes ? query.stockCodes.split(',') : undefined,
      newsId: query.newsId,
      hasHighlight: query.hasHighlight === 'true' ? true : query.hasHighlight === 'false' ? false : undefined,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit,
      offset,
    };

    const result = await this.folioService.getFilteredNotes(userId, filters);

    reply.send({
      success: true,
      data: {
        notes: result.notes,
        total: result.total,
      },
      meta: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.notes.length < result.total,
      },
    });
  }
}


