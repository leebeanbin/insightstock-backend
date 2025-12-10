import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { createStepTracker } from '../utils/aop';
import { withRetry } from '../utils/retry';
import { NotFoundError } from '../errors/AppError';

/**
 * 노트 서비스
 */
export class NoteService {
  /**
   * 사용자의 노트 목록 조회
   * @param newsId (optional) 특정 뉴스의 노트만 조회
   */
  async getNotes(userId: string, limit: number = 50, offset: number = 0, newsId?: string) {
    const tracker = createStepTracker('NoteService.getNotes');

    try {
      tracker.step('Note 조회 시작');

      // where 조건 구성
      const where = newsId
        ? { userId, newsId }
        : { userId };

      const [notes, total] = await Promise.all([
        prisma.note.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.note.count({ where }),
      ]);
      tracker.step('Note 조회 완료');

      tracker.step('DTO 변환');
      const result = {
        notes: notes.map(note => ({
          id: note.id,
          title: note.title,
          content: note.content,
          tags: note.tags || [],
          newsId: note.newsId ?? undefined,
          scrapedContent: note.scrapedContent ?? undefined,
          sourceUrl: note.sourceUrl ?? undefined,
          highlightStart: note.highlightStart ?? undefined,
          highlightEnd: note.highlightEnd ?? undefined,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        })),
        total,
      };
      tracker.finish();
      return result;
    } catch (error) {
      logger.error('NoteService.getNotes error:', error);
      tracker.finish();
      throw error;
    }
  }

  /**
   * 노트 상세 조회
   */
  async getNoteById(userId: string, noteId: string) {
    const tracker = createStepTracker('NoteService.getNoteById');
    
    try {
      tracker.step('Note 조회 시작');
      const note = await prisma.note.findFirst({
        where: {
          id: noteId,
          userId,
        },
      });

      if (!note) {
        tracker.finish();
        return null;
      }
      tracker.step('Note 조회 완료');

      tracker.finish();
      return {
        id: note.id,
        title: note.title,
        content: note.content,
        tags: note.tags || [],
        newsId: note.newsId ?? undefined,
        scrapedContent: note.scrapedContent ?? undefined,
        sourceUrl: note.sourceUrl ?? undefined,
        highlightStart: note.highlightStart ?? undefined,
        highlightEnd: note.highlightEnd ?? undefined,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      };
    } catch (error) {
      logger.error('NoteService.getNoteById error:', error);
      tracker.finish();
      throw error;
    }
  }

  /**
   * 노트 생성
   *
   * 동시성 처리:
   * 1. Idempotency Key로 중복 생성 방지
   * 2. 재시도 로직으로 일시적 장애 처리
   * 3. 트랜잭션으로 데이터 일관성 보장
   */
  async createNote(
    userId: string,
    data: {
      title: string;
      content: string;
      tags?: string[];
      newsId?: string;
      scrapedContent?: string;
      sourceUrl?: string;
      highlightStart?: number;
      highlightEnd?: number;
    }
  ) {
    const tracker = createStepTracker('NoteService.createNote');

    try {
      tracker.step('Note 생성 시작 (재시도 가능)');

      // 디버깅용 로그
      logger.info('=== NoteService.createNote 호출 ===');
      logger.info('userId:', userId);
      logger.info('data:', JSON.stringify(data, null, 2));

      // 재시도 로직과 함께 실행 (Idempotency 제거: 같은 뉴스에 여러 노트 가능)
      const result = await withRetry(
          async () => {
            // newsId가 있으면 뉴스 존재 여부 확인 (트랜잭션 내에서)
            const note = await prisma.$transaction(async (tx) => {
              // newsId 검증
              if (data.newsId) {
                const news = await tx.news.findUnique({
                  where: { id: data.newsId },
                });
                if (!news) {
                  throw new Error(`News with id ${data.newsId} not found`);
                }
              }

              // Note 생성
              return await tx.note.create({
                data: {
                  userId,
                  title: data.title,
                  content: data.content,
                  tags: data.tags || [],
                  newsId: data.newsId,
                  scrapedContent: data.scrapedContent,
                  sourceUrl: data.sourceUrl,
                  highlightStart: data.highlightStart,
                  highlightEnd: data.highlightEnd,
                },
              });
            });

            tracker.step('Note 생성 완료');
            logger.info('생성된 노트:', JSON.stringify(note, null, 2));
            return note;
          },
          {
            maxRetries: 3,
            delayMs: 100,
            exponentialBackoff: true,
            onRetry: (attempt, error) => {
              logger.warn('Retrying note creation', {
                userId,
                attempt,
                error: error.message,
              });
            },
          }
        );

      const formattedResult = {
        id: result.id,
        title: result.title,
        content: result.content,
        tags: result.tags || [],
        newsId: result.newsId ?? undefined,
        scrapedContent: result.scrapedContent ?? undefined,
        sourceUrl: result.sourceUrl ?? undefined,
        highlightStart: result.highlightStart ?? undefined,
        highlightEnd: result.highlightEnd ?? undefined,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };

      tracker.finish();
      return formattedResult;
    } catch (error) {
      logger.error('NoteService.createNote error:', error);
      tracker.finish();
      throw error;
    }
  }

  /**
   * 노트 수정
   *
   * 동시성 체크:
   * - Prisma의 update는 WHERE 조건에 userId를 포함하므로 동시 수정 시 마지막 쓰기 승리(Last Write Wins)
   * - 매수/매도가 없으므로 민감한 데이터가 아니므로 현재 구조로 충분
   * - 필요시 Optimistic Locking (version 필드) 추가 가능
   */
  async updateNote(userId: string, noteId: string, data: { title?: string; content?: string; tags?: string[] }) {
    const tracker = createStepTracker('NoteService.updateNote');

    try {
      tracker.step('Note 수정 시작');

      // updateMany를 사용하여 복합 where 조건 지원
      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.content !== undefined) updateData.content = data.content;
      if (data.tags !== undefined) updateData.tags = data.tags;

      const result = await prisma.note.updateMany({
        where: {
          id: noteId,
          userId,
        },
        data: updateData,
      });

      // 수정된 레코드가 없으면 404
      if (result.count === 0) {
        throw new NotFoundError('Note');
      }

      tracker.step('Note 수정 완료, 재조회 중');

      // 수정된 노트를 다시 조회
      const note = await prisma.note.findFirst({
        where: { id: noteId, userId },
      });

      if (!note) {
        throw new NotFoundError('Note');
      }

      const formattedResult = {
        id: note.id,
        title: note.title,
        content: note.content,
        tags: note.tags || [],
        newsId: note.newsId ?? undefined,
        scrapedContent: note.scrapedContent ?? undefined,
        sourceUrl: note.sourceUrl ?? undefined,
        highlightStart: note.highlightStart ?? undefined,
        highlightEnd: note.highlightEnd ?? undefined,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      };
      tracker.finish();
      return formattedResult;
    } catch (error) {
      logger.error('NoteService.updateNote error:', error);
      tracker.finish();
      throw error;
    }
  }

  /**
   * 노트 삭제
   */
  async deleteNote(userId: string, noteId: string) {
    const tracker = createStepTracker('NoteService.deleteNote');

    try {
      tracker.step('Note 삭제 시작');

      // deleteMany를 사용하여 복합 where 조건 지원
      const result = await prisma.note.deleteMany({
        where: {
          id: noteId,
          userId,
        },
      });

      // 삭제된 레코드가 없으면 404
      if (result.count === 0) {
        throw new NotFoundError('Note');
      }

      tracker.step('Note 삭제 완료');
      tracker.finish();
      return true;
    } catch (error) {
      logger.error('NoteService.deleteNote error:', error);
      tracker.finish();
      throw error;
    }
  }
}

