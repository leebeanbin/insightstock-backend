/**
 * Message Queue Service
 * BullMQ를 사용한 메시지 큐 서비스
 * OpenAI API 호출 및 메시지 저장을 비동기로 처리
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { IChatFacade } from '../facades/IChatFacade';
import { CreateChatDto } from '../dto/chat/CreateChatDto';

interface ChatJobData {
  userId: string;
  dto: CreateChatDto;
  conversationId?: string;
}

interface ChatJobResult {
  conversationId: string;
  messageId: string;
  content: string;
}

/**
 * 채팅 메시지 큐
 */
export class MessageQueueService {
  private chatQueue: Queue<ChatJobData, ChatJobResult>;
  private chatWorker: Worker<ChatJobData, ChatJobResult>;
  private queueEvents: QueueEvents;

  constructor(private readonly chatFacade: IChatFacade) {
    // 큐 생성
    this.chatQueue = new Queue('chat', {
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

    // 워커 생성 (OpenAI API 호출 처리)
    this.chatWorker = new Worker<ChatJobData, ChatJobResult>(
      'chat',
      async (job) => {
        const { userId, dto } = job.data;
        logger.info(`Processing chat job ${job.id} for user ${userId}`);

        let fullContent = '';
        let conversationId = dto.conversationId || '';

        // OpenAI 스트리밍 응답 수집
        const stream = this.chatFacade.streamChat(userId, dto);
        for await (const chunk of stream) {
          fullContent += chunk;
        }

        // 대화 ID가 없었는데 생성된 경우 추출 (streamChat에서 생성됨)
        // TODO: streamChat이 conversationId를 반환하도록 수정 필요

        return {
          conversationId: conversationId || `conv_${Date.now()}`,
          messageId: `msg_${Date.now()}`,
          content: fullContent,
        };
      },
      {
        connection: redis,
        concurrency: 5, // 동시에 5개 작업 처리
        limiter: {
          max: 50, // 최대 50개 작업
          duration: 60000, // 1분당
        },
      }
    );

    // 큐 이벤트 리스너
    this.queueEvents = new QueueEvents('chat', { connection: redis });

    this.setupEventHandlers();
  }

  /**
   * 채팅 작업 추가
   */
  async addChatJob(userId: string, dto: CreateChatDto, priority: number = 0) {
    const job = await this.chatQueue.add(
      'chat-message',
      { userId, dto },
      {
        priority,
        jobId: `chat-${userId}-${Date.now()}`,
      }
    );

    logger.info(`Chat job added: ${job.id} for user ${userId}`);
    return job;
  }

  /**
   * 작업 상태 조회
   */
  async getJobStatus(jobId: string) {
    const job = await this.chatQueue.getJob(jobId);
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
      logger.info(`Chat job completed: ${jobId}`, returnvalue);
    });

    // 작업 실패
    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Chat job failed: ${jobId}`, failedReason);
    });

    // 작업 진행
    this.queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug(`Chat job progress: ${jobId}`, data);
    });

    // 워커 에러
    this.chatWorker.on('error', (error) => {
      logger.error('Chat worker error:', error);
    });
  }

  /**
   * 큐 통계 조회
   */
  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.chatQueue.getWaitingCount(),
      this.chatQueue.getActiveCount(),
      this.chatQueue.getCompletedCount(),
      this.chatQueue.getFailedCount(),
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
    await this.chatWorker.close();
    await this.chatQueue.close();
    await this.queueEvents.close();
    logger.info('Message queue service cleaned up');
  }
}

