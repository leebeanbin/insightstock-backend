import { FastifyRequest, FastifyReply } from 'fastify';
import { LearningRecommendationService } from '../services/LearningRecommendationService';
import { prisma } from '../config/prisma';
import { NotFoundError } from '../errors/AppError';

export class LearningController {
  constructor(
    private readonly recommendationService: LearningRecommendationService = new LearningRecommendationService()
  ) {}

  /**
   * 학습 Q&A 목록 조회
   */
  async getLearningQAs(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { concept, limit = '20', offset = '0' } = request.query as {
      concept?: string;
      limit?: string;
      offset?: string;
    };

    const where = concept ? { concept } : {};

    const [items, total] = await Promise.all([
      prisma.learning.findMany({
        where,
        take: parseInt(limit),
        skip: parseInt(offset),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.learning.count({ where }),
    ]);

    reply.send({
      success: true,
      data: items,
      meta: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit),
      },
    });
  }

  /**
   * 학습 Q&A 상세 조회
   */
  async getLearningQAById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    const item = await prisma.learning.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundError('Learning Q&A');
    }

    reply.send({
      success: true,
      data: item,
    });
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

