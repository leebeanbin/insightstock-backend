import { FastifyRequest, FastifyReply } from 'fastify';
import { LearningRecommendationService } from '../services/LearningRecommendationService';
import { prisma } from '../config/prisma';
import { NotFoundError } from '../errors/AppError';
import { logger } from '../config/logger';

export class LearningController {
  constructor(
    private readonly recommendationService: LearningRecommendationService = new LearningRecommendationService()
  ) {}

  /**
   * 학습 Q&A 목록 조회 (최적화: select, 인덱스 활용, 캐싱)
   */
  async getLearningQAs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { userId, concept, stockCode, limit = '20', offset = '0' } = request.query as {
      userId?: string;
      concept?: string;
      stockCode?: string;
      limit?: string;
      offset?: string;
    };

    // 파라미터 검증 및 정규화
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20)); // 1-100 사이로 제한
    const offsetNum = Math.max(0, parseInt(offset) || 0); // 0 이상

    // 쿼리 조건 구성 (인덱스 활용)
    const where: any = {};
    if (userId) {
      where.userId = userId; // userId 인덱스 사용
    }
    if (concept) {
      where.concept = concept; // concept 인덱스 사용
    }
    if (stockCode) {
      where.relatedStocks = { has: stockCode }; // GIN 인덱스 사용
    }

    // 캐시 키 생성
    const cacheKey = `learning:list:${JSON.stringify(where)}:${limitNum}:${offsetNum}`;
    
    try {
      // 캐시 확인
      const { cacheService } = await import('../services/CacheService');
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        reply.send(cached);
        return;
      }

      // 쿼리 최적화: select로 필요한 필드만 조회
      const [items, total] = await Promise.all([
        prisma.learning.findMany({
          where,
          take: limitNum,
          skip: offsetNum,
          orderBy: { createdAt: 'desc' }, // userId + createdAt 인덱스 활용
          select: {
            id: true,
            userId: true,
            concept: true,
            question: true,
            answer: true,
            relatedStocks: true,
            createdAt: true,
            // user 관계는 필요시에만 include
          },
        }),
        prisma.learning.count({ where }),
      ]);

      const response = {
        success: true,
        data: items,
        meta: {
          total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: total > offsetNum + limitNum,
        },
      };

      // 캐시 저장 (5분 TTL)
      await cacheService.set(cacheKey, response, 300);

      reply.send(response);
    } catch (error) {
      logger.error('Error fetching learning Q&As:', error);
      // 캐시 실패 시에도 정상 동작
      const [items, total] = await Promise.all([
        prisma.learning.findMany({
          where,
          take: limitNum,
          skip: offsetNum,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userId: true,
            concept: true,
            question: true,
            answer: true,
            relatedStocks: true,
            createdAt: true,
          },
        }),
        prisma.learning.count({ where }),
      ]);

      reply.send({
        success: true,
        data: items,
        meta: {
          total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: total > offsetNum + limitNum,
        },
      });
    }
  }

  /**
   * 학습 Q&A 상세 조회 (최적화: select 사용, 캐싱)
   */
  async getLearningQAById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    const cacheKey = `learning:${id}`;
    try {
      // 캐시 확인
      const { cacheService } = await import('../services/CacheService');
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        reply.send(cached);
        return;
      }

      // 쿼리 최적화: select로 필요한 필드만 조회
      const item = await prisma.learning.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          concept: true,
          question: true,
          answer: true,
          relatedStocks: true,
          createdAt: true,
        },
      });

      if (!item) {
        throw new NotFoundError('Learning Q&A');
      }

      const response = {
        success: true,
        data: item,
      };

      // 캐시 저장 (5분 TTL)
      await cacheService.set(cacheKey, response, 300);
      reply.send(response);
    } catch (error) {
      // 캐시 실패 시에도 정상 동작
      const item = await prisma.learning.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          concept: true,
          question: true,
          answer: true,
          relatedStocks: true,
          createdAt: true,
        },
      });

      if (!item) {
        throw new NotFoundError('Learning Q&A');
      }

      reply.send({
        success: true,
        data: item,
      });
    }
  }

  /**
   * 학습 Q&A 생성 (단일) - 메시지 큐로 비동기 처리
   */
  async createLearning(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { concept, question, answer, relatedStocks } = request.body as {
      concept?: string;
      question?: string;
      answer?: string;
      relatedStocks?: string[];
    };
    const userId = request.userId!;

    // 입력 검증
    if (!question || !question.trim()) {
      reply.code(400).send({
        success: false,
        error: 'Question is required',
      });
      return;
    }
    if (!answer || !answer.trim()) {
      reply.code(400).send({
        success: false,
        error: 'Answer is required',
      });
      return;
    }
    const finalConcept = concept?.trim() || 'chat';
    const finalQuestion = question.trim();
    const finalAnswer = answer.trim();

    // 메시지 큐로 비동기 처리 (성능 최적화)
    try {
      const { getLearningQueueService } = await import('../services/LearningQueueService');
      const queueService = getLearningQueueService();
      
      const job = await queueService.addLearningJob({
        userId,
        concept: finalConcept,
        question: finalQuestion,
        answer: finalAnswer,
        relatedStocks: relatedStocks || [],
      });

      // 작업 ID 반환 (상태 조회용)
      reply.code(202).send({
        success: true,
        message: 'Learning creation queued',
        jobId: job.id,
      });
    } catch (error) {
      logger.error('Failed to queue learning creation:', error);
      // 폴백: 동기 처리
      const learning = await prisma.learning.create({
        data: {
          userId,
          concept: finalConcept,
          question: finalQuestion,
          answer: finalAnswer,
          relatedStocks: relatedStocks || [],
        },
        select: {
          id: true,
          userId: true,
          concept: true,
          question: true,
          answer: true,
          relatedStocks: true,
          createdAt: true,
        },
      });

      reply.code(201).send({
        success: true,
        data: learning,
      });
    }
  }

  /**
   * 학습 Q&A 배치 생성 (성능 최적화: 메시지 큐 + createMany)
   */
  async createLearningsBatch(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const learnings = request.body as Array<{
      userId?: string;
      concept?: string;
      question?: string;
      answer?: string;
      relatedStocks?: string[];
    }>;

    if (!Array.isArray(learnings) || learnings.length === 0) {
      reply.code(400).send({
        success: false,
        error: 'Invalid request body: expected array of learnings',
      });
      return;
    }

    // 최대 개수 제한 (성능 및 보안)
    const MAX_BATCH_SIZE = 100;
    if (learnings.length > MAX_BATCH_SIZE) {
      reply.code(400).send({
        success: false,
        error: `Batch size exceeds maximum limit of ${MAX_BATCH_SIZE}`,
      });
      return;
    }

    // 입력 검증 및 정규화
    const validatedLearnings = learnings
      .map((learning, index) => {
        if (!learning.question?.trim()) {
          throw new Error(`Learning at index ${index}: question is required`);
        }
        if (!learning.answer?.trim()) {
          throw new Error(`Learning at index ${index}: answer is required`);
        }
        return {
          userId: learning.userId || request.userId!,
          concept: learning.concept?.trim() || 'chat',
          question: learning.question.trim(),
          answer: learning.answer.trim(),
          relatedStocks: learning.relatedStocks || [],
        };
      })
      .filter(Boolean);

    // 메시지 큐로 비동기 배치 처리 (성능 최적화)
    try {
      const { getLearningQueueService } = await import('../services/LearningQueueService');
      const queueService = getLearningQueueService();
      
      const job = await queueService.addLearningBatchJob({
        learnings: validatedLearnings,
      });

      // 작업 ID 반환 (상태 조회용)
      reply.code(202).send({
        success: true,
        message: 'Learning batch creation queued',
        jobId: job.id,
        count: validatedLearnings.length,
      });
    } catch (error) {
      logger.error('Failed to queue learning batch creation:', error);
      
      // 입력 검증 에러 처리
      if (error instanceof Error && error.message.includes('is required')) {
        reply.code(400).send({
          success: false,
          error: error.message,
        });
        return;
      }
      
      // 폴백: 동기 배치 처리 (createMany 사용 - 더 빠름)
      const created = await prisma.learning.createMany({
        data: validatedLearnings,
        skipDuplicates: true,
      });

      // 생성된 레코드 조회 (최적화: 인덱스 활용, select 사용)
      // userId 인덱스와 createdAt 인덱스를 활용하여 최근 생성된 레코드만 조회
      const createdLearnings = await prisma.learning.findMany({
        where: {
          userId: { in: validatedLearnings.map((l) => l.userId) }, // userId 인덱스 활용
          question: { in: validatedLearnings.map((l) => l.question) },
          createdAt: {
            gte: new Date(Date.now() - 5000), // 최근 5초 내 생성된 레코드만
          },
        },
        orderBy: { createdAt: 'desc' }, // createdAt 인덱스 활용
        take: validatedLearnings.length,
        select: {
          id: true,
          userId: true,
          concept: true,
          question: true,
          answer: true,
          relatedStocks: true,
          createdAt: true,
        },
      });

      // 캐시 무효화
      try {
        const { cacheService } = await import('../services/CacheService');
        await cacheService.deletePattern('learning:list:*');
        const userIds = Array.from(new Set(validatedLearnings.map((l) => l.userId)));
        for (const uid of userIds) {
          await cacheService.deletePattern(`learning:list:*userId*${uid}*`);
        }
      } catch (error) {
        // 캐시 무효화 실패는 무시
        logger.warn('Failed to invalidate cache:', error);
      }

      reply.code(201).send({
        success: true,
        data: createdLearnings,
        meta: {
          count: created.count,
        },
      });
    }
  }

  /**
   * 오늘의 학습 추천 조회
   */
  async getTodayRecommendations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId!;
    const recommendations = await this.recommendationService.getTodayRecommendations(userId);

    reply.send({
      success: true,
      data: recommendations,
    });
  }
}

