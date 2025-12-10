/**
 * Queue Manager
 * BullMQ 확장 및 브랜치별 큐 그룹 관리
 */

import { Queue, Worker, QueueEvents, QueueOptions, WorkerOptions } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { PipelineBranch } from '../pipelines/PipelineManager';

/**
 * 큐 설정
 */
interface QueueConfig {
  name: string;
  options?: QueueOptions;
  workerOptions?: WorkerOptions;
  processor?: (job: any) => Promise<any>;
}

/**
 * Queue Manager
 */
export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private branchQueues: Map<PipelineBranch, Queue> = new Map();

  constructor() {
    logger.info('QueueManager initialized');
  }

  /**
   * 큐 생성
   */
  createQueue(name: string, options?: QueueOptions): Queue {
    if (this.queues.has(name)) {
      logger.warn(`Queue ${name} already exists, returning existing queue`);
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // 1시간
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // 24시간
        },
      },
      ...options,
    });

    this.queues.set(name, queue);
    logger.info(`Queue created: ${name}`);

    return queue;
  }

  /**
   * 브랜치별 큐 가져오기 또는 생성
   */
  getBranchQueue(branch: PipelineBranch): Queue {
    if (this.branchQueues.has(branch)) {
      return this.branchQueues.get(branch)!;
    }

    const queueName = `branch:${branch}`;
    const queue = this.createQueue(queueName, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.branchQueues.set(branch, queue);
    logger.info(`Branch queue created: ${branch}`);

    return queue;
  }

  /**
   * 워커 생성
   */
  createWorker(
    queueName: string,
    processor: (job: any) => Promise<any>,
    options?: WorkerOptions
  ): Worker {
    if (this.workers.has(queueName)) {
      logger.warn(`Worker for queue ${queueName} already exists`);
      return this.workers.get(queueName)!;
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    const worker = new Worker(
      queueName,
      processor,
      {
        connection: redis,
        concurrency: 5,
        limiter: {
          max: 50,
          duration: 60000, // 1분
        },
        ...options,
      }
    );

    // 워커 이벤트 리스너
    worker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed in queue ${queueName}`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed in queue ${queueName}:`, err);
    });

    worker.on('error', (err) => {
      logger.error(`Worker error in queue ${queueName}:`, err);
    });

    this.workers.set(queueName, worker);
    logger.info(`Worker created for queue: ${queueName}`);

    return worker;
  }

  /**
   * 큐 이벤트 리스너 생성
   */
  createQueueEvents(queueName: string): QueueEvents {
    if (this.queueEvents.has(queueName)) {
      return this.queueEvents.get(queueName)!;
    }

    const queueEvents = new QueueEvents(queueName, { connection: redis });

    queueEvents.on('completed', ({ jobId }) => {
      logger.debug(`Queue event: job ${jobId} completed in ${queueName}`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Queue event: job ${jobId} failed in ${queueName}: ${failedReason}`);
    });

    this.queueEvents.set(queueName, queueEvents);
    logger.info(`Queue events created for: ${queueName}`);

    return queueEvents;
  }

  /**
   * 큐 가져오기
   */
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  /**
   * 워커 가져오기
   */
  getWorker(name: string): Worker | undefined {
    return this.workers.get(name);
  }

  /**
   * 큐 통계 조회
   */
  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  } | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * 모든 큐 통계 조회
   */
  async getAllQueueStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const [name] of this.queues) {
      stats[name] = await this.getQueueStats(name);
    }

    return stats;
  }

  /**
   * 정리 (서버 종료 시)
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up QueueManager...');

    // 워커 종료
    for (const [name, worker] of this.workers) {
      await worker.close();
      logger.info(`Worker closed: ${name}`);
    }

    // 큐 이벤트 종료
    for (const [name, queueEvents] of this.queueEvents) {
      await queueEvents.close();
      logger.info(`Queue events closed: ${name}`);
    }

    // 큐 종료
    for (const [name, queue] of this.queues) {
      await queue.close();
      logger.info(`Queue closed: ${name}`);
    }

    this.queues.clear();
    this.workers.clear();
    this.queueEvents.clear();
    this.branchQueues.clear();

    logger.info('QueueManager cleaned up');
  }
}

// 싱글톤 인스턴스
let queueManagerInstance: QueueManager | null = null;

/**
 * QueueManager 싱글톤 인스턴스 가져오기
 */
export function getQueueManager(): QueueManager {
  if (!queueManagerInstance) {
    queueManagerInstance = new QueueManager();
  }
  return queueManagerInstance;
}

