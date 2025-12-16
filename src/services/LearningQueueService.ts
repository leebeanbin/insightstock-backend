/**
 * Learning Queue Service
 * BullMQ를 사용한 Learning 저장 메시지 큐 서비스
 * AI 서비스처럼 비동기 배치 처리로 성능 최적화
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';

interface LearningJobData {
  userId: string;
  concept: string;
  question: string;
  answer: string;
  relatedStocks?: string[];
}

interface LearningBatchJobData {
  learnings: LearningJobData[];
}

interface LearningJobResult {
  id: string;
  userId: string;
  concept: string;
  question: string;
  answer: string;
  relatedStocks: string[];
  createdAt: Date;
}

/**
 * Learning 저장 큐 서비스
 */
export class LearningQueueService {
  private learningQueue: Queue<LearningJobData | LearningBatchJobData, LearningJobResult | LearningJobResult[]>;
  private learningWorker: Worker<LearningJobData | LearningBatchJobData, LearningJobResult | LearningJobResult[]>;
  private queueEvents: QueueEvents;

  constructor() {
    // 큐 생성
    this.learningQueue = new Queue('learning', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // 1시간 후 완료된 작업 삭제
          count: 1000, // 최대 1000개 유지
        },
        removeOnFail: {
          age: 86400, // 24시간 후 실패한 작업 삭제
        },
      },
    });

    // 워커 생성 (배치 처리 최적화)
    this.learningWorker = new Worker<LearningJobData | LearningBatchJobData, LearningJobResult | LearningJobResult[]>(
      'learning',
      async (job) => {
        logger.info(`Processing learning job ${job.id}`);

        // 배치 작업인지 확인
        if ('learnings' in job.data) {
          // 배치 저장 (성능 최적화: createMany 사용)
          const batchData = job.data as LearningBatchJobData;
          const created = await prisma.learning.createMany({
            data: batchData.learnings.map((l) => ({
              userId: l.userId,
              concept: l.concept,
              question: l.question,
              answer: l.answer,
              relatedStocks: l.relatedStocks || [],
            })),
            skipDuplicates: true, // 중복 건너뛰기
          });

          // 생성된 레코드 조회 (createMany는 ID를 반환하지 않음)
          const learnings = await prisma.learning.findMany({
            where: {
              userId: { in: batchData.learnings.map((l) => l.userId) },
              question: { in: batchData.learnings.map((l) => l.question) },
              createdAt: {
                gte: new Date(Date.now() - 5000), // 5초 이내 생성된 것만
              },
            },
            orderBy: { createdAt: 'desc' },
            take: batchData.learnings.length,
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
            const { cacheService } = await import('./CacheService');
            await cacheService.deletePattern('learning:list:*');
            const userIds = Array.from(new Set(batchData.learnings.map((l) => l.userId)));
            for (const uid of userIds) {
              await cacheService.deletePattern(`learning:list:*userId*${uid}*`);
            }
          } catch (error) {
            // 캐시 무효화 실패는 무시
          }

          logger.info(`Batch created ${created.count} learnings`);
          return learnings as LearningJobResult[];
        } else {
          // 단일 저장
          const data = job.data as LearningJobData;
          const learning = await prisma.learning.create({
            data: {
              userId: data.userId,
              concept: data.concept,
              question: data.question,
              answer: data.answer,
              relatedStocks: data.relatedStocks || [],
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

          // 캐시 무효화
          try {
            const { cacheService } = await import('./CacheService');
            await cacheService.deletePattern('learning:list:*');
            await cacheService.deletePattern(`learning:list:*userId*${data.userId}*`);
          } catch (error) {
            // 캐시 무효화 실패는 무시
          }

          logger.info(`Created learning ${learning.id} for user ${data.userId}`);
          return learning as LearningJobResult;
        }
      },
      {
        connection: redis,
        concurrency: 10, // 동시에 10개 작업 처리 (배치 최적화)
        limiter: {
          max: 200, // 최대 200개 작업 (배치 처리 고려)
          duration: 60000, // 1분당
        },
      }
    );

    // 큐 이벤트 리스너
    this.queueEvents = new QueueEvents('learning', { connection: redis });

    this.setupEventHandlers();
  }

  /**
   * 단일 Learning 저장 작업 추가
   */
  async addLearningJob(data: LearningJobData, priority: number = 0) {
    const job = await this.learningQueue.add(
      'learning-single',
      data,
      {
        priority,
        jobId: `learning-${data.userId}-${Date.now()}`,
      }
    );

    logger.debug(`Learning job added: ${job.id} for user ${data.userId}`);
    return job;
  }

  /**
   * 배치 Learning 저장 작업 추가 (성능 최적화)
   */
  async addLearningBatchJob(data: LearningBatchJobData, priority: number = 0) {
    const job = await this.learningQueue.add(
      'learning-batch',
      data,
      {
        priority,
        jobId: `learning-batch-${Date.now()}`,
      }
    );

    logger.info(`Learning batch job added: ${job.id} (${data.learnings.length} items)`);
    return job;
  }

  /**
   * 작업 상태 조회
   */
  async getJobStatus(jobId: string) {
    const job = await this.learningQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue || null;

    return {
      id: job.id,
      state,
      progress,
      result,
    };
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers() {
    // 작업 완료
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.debug(`Learning job completed: ${jobId}`);
    });

    // 작업 실패
    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Learning job failed: ${jobId}`, failedReason);
    });

    // 작업 진행
    this.queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug(`Learning job progress: ${jobId}`, data);
    });

    // 워커 에러
    this.learningWorker.on('error', (error) => {
      logger.error('Learning worker error:', error);
    });
  }

  /**
   * 큐 통계 조회
   */
  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.learningQueue.getWaitingCount(),
      this.learningQueue.getActiveCount(),
      this.learningQueue.getCompletedCount(),
      this.learningQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
    };
  }

  /**
   * 정리 (서버 종료 시)
   */
  async cleanup() {
    await this.learningWorker.close();
    await this.learningQueue.close();
    await this.queueEvents.close();
    logger.info('Learning queue service cleaned up');
  }
}

// 싱글톤 인스턴스
let learningQueueServiceInstance: LearningQueueService | null = null;

/**
 * LearningQueueService 싱글톤 인스턴스 가져오기
 */
export function getLearningQueueService(): LearningQueueService {
  if (!learningQueueServiceInstance) {
    learningQueueServiceInstance = new LearningQueueService();
  }
  return learningQueueServiceInstance;
}

