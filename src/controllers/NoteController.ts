import { FastifyRequest, FastifyReply } from 'fastify';
import { NoteService } from '../services/NoteService';
import { NotFoundError } from '../errors/AppError';
import { parseQueryInt } from '../utils/query';
import { PAGINATION } from '../constants/pagination';

export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  /**
   * 노트 목록 조회
   * @query newsId (optional) 특정 뉴스의 노트만 조회
   */
  async getNotes(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const query = request.query as { limit?: string; offset?: string; newsId?: string };
    const limit = parseQueryInt(query.limit, PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MIN_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
    const offset = parseQueryInt(query.offset, 0, 0);
    const newsId = query.newsId;

    const result = await this.noteService.getNotes(userId, limit, offset, newsId);

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

  /**
   * 노트 상세 조회
   */
  async getNoteById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const { id } = request.params as { id: string };

    const note = await this.noteService.getNoteById(userId, id);

    if (!note) {
      throw new NotFoundError('Note');
    }

    reply.send({
      success: true,
      data: note,
    });
  }

  /**
   * 노트 생성
   */
  async createNote(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const { title, content, tags, newsId, scrapedContent, sourceUrl, highlightStart, highlightEnd } = request.body as {
      title: string;
      content: string;
      tags?: string[];
      newsId?: string;
      scrapedContent?: string;
      sourceUrl?: string;
      highlightStart?: number;
      highlightEnd?: number;
    };

    const note = await this.noteService.createNote(userId, {
      title,
      content,
      tags,
      newsId,
      scrapedContent,
      sourceUrl,
      highlightStart,
      highlightEnd,
    });

    reply.status(201).send({
      success: true,
      data: note,
    });
  }

  /**
   * 노트 수정
   */
  async updateNote(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const { id } = request.params as { id: string };
    const { title, content, tags } = request.body as {
      title?: string;
      content?: string;
      tags?: string[];
    };

    const note = await this.noteService.updateNote(userId, id, { title, content, tags });

    reply.send({
      success: true,
      data: note,
    });
  }

  /**
   * 노트 삭제
   */
  async deleteNote(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const { id } = request.params as { id: string };

    await this.noteService.deleteNote(userId, id);

    reply.send({
      success: true,
      message: 'Note deleted successfully',
    });
  }
}

