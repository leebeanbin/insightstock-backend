/**
 * Event Stream
 * Redis Streams를 활용한 작업 실행 이벤트 로깅
 * 
 * 기능:
 * 1. 작업 실행 이벤트 기록
 * 2. 이벤트 조회 및 분석
 * 3. 실시간 모니터링 지원
 */

import { redis } from '../config/redis';
import { logger } from '../config/logger';

/**
 * 이벤트 타입
 */
export enum EventType {
  JOB_START = 'job:start',
  JOB_COMPLETE = 'job:complete',
  JOB_FAIL = 'job:fail',
  JOB_RETRY = 'job:retry',
  PIPELINE_START = 'pipeline:start',
  PIPELINE_COMPLETE = 'pipeline:complete',
}

/**
 * 이벤트 데이터
 */
export interface EventData {
  jobId: string;
  branch?: string;
  status: string;
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Event Stream
 */
export class EventStream {
  private streamName = 'job:events';

  /**
   * 이벤트 기록
   */
  async logEvent(type: EventType, data: EventData): Promise<void> {
    try {
      const eventData = {
        type,
        jobId: data.jobId,
        branch: data.branch || '',
        status: data.status,
        duration: data.duration?.toString() || '',
        error: data.error || '',
        metadata: data.metadata ? JSON.stringify(data.metadata) : '',
        timestamp: Date.now().toString(),
      };

      await redis.xadd(
        this.streamName,
        '*',
        ...Object.entries(eventData).flat()
      );

      logger.debug(`Event logged: ${type} - ${data.jobId}`);
    } catch (error) {
      logger.error(`Failed to log event ${type}:`, error);
    }
  }

  /**
   * 작업 시작 이벤트
   */
  async logJobStart(jobId: string, branch?: string, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent(EventType.JOB_START, {
      jobId,
      branch,
      status: 'running',
      metadata,
    });
  }

  /**
   * 작업 완료 이벤트
   */
  async logJobComplete(
    jobId: string,
    duration: number,
    branch?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent(EventType.JOB_COMPLETE, {
      jobId,
      branch,
      status: 'completed',
      duration,
      metadata,
    });
  }

  /**
   * 작업 실패 이벤트
   */
  async logJobFail(
    jobId: string,
    error: Error,
    branch?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent(EventType.JOB_FAIL, {
      jobId,
      branch,
      status: 'failed',
      error: error.message,
      metadata: {
        ...metadata,
        stack: error.stack,
      },
    });
  }

  /**
   * 작업 재시도 이벤트
   */
  async logJobRetry(
    jobId: string,
    retryCount: number,
    branch?: string
  ): Promise<void> {
    await this.logEvent(EventType.JOB_RETRY, {
      jobId,
      branch,
      status: 'retrying',
      metadata: {
        retryCount,
      },
    });
  }

  /**
   * 파이프라인 시작 이벤트
   */
  async logPipelineStart(branch: string, jobCount: number): Promise<void> {
    await this.logEvent(EventType.PIPELINE_START, {
      jobId: `pipeline:${branch}`,
      branch,
      status: 'running',
      metadata: {
        jobCount,
      },
    });
  }

  /**
   * 파이프라인 완료 이벤트
   */
  async logPipelineComplete(
    branch: string,
    duration: number,
    stats: { completed: number; failed: number }
  ): Promise<void> {
    await this.logEvent(EventType.PIPELINE_COMPLETE, {
      jobId: `pipeline:${branch}`,
      branch,
      status: 'completed',
      duration,
      metadata: stats,
    });
  }

  /**
   * 최근 이벤트 조회
   */
  async getRecentEvents(count: number = 100): Promise<any[]> {
    try {
      const events = await redis.xrevrange(
        this.streamName,
        '+',
        '-',
        'COUNT',
        count
      );

      return events.map(([id, fields]) => {
        const event: any = { id };
        for (let i = 0; i < fields.length; i += 2) {
          event[fields[i]] = fields[i + 1];
        }
        return event;
      });
    } catch (error) {
      logger.error('Failed to get recent events:', error);
      return [];
    }
  }

  /**
   * 특정 작업의 이벤트 조회
   */
  async getJobEvents(jobId: string, count: number = 50): Promise<any[]> {
    try {
      const allEvents = await this.getRecentEvents(1000);
      return allEvents
        .filter((event) => event.jobId === jobId)
        .slice(0, count);
    } catch (error) {
      logger.error(`Failed to get events for job ${jobId}:`, error);
      return [];
    }
  }

  /**
   * 브랜치별 이벤트 조회
   */
  async getBranchEvents(branch: string, count: number = 100): Promise<any[]> {
    try {
      const allEvents = await this.getRecentEvents(1000);
      return allEvents
        .filter((event) => event.branch === branch)
        .slice(0, count);
    } catch (error) {
      logger.error(`Failed to get events for branch ${branch}:`, error);
      return [];
    }
  }

  /**
   * 오래된 이벤트 정리 (일정 기간 이상 지난 이벤트 삭제)
   */
  async cleanupOldEvents(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const cutoffTime = Date.now() - maxAge;
      const events = await redis.xrange(this.streamName, '-', '+');
      
      let deletedCount = 0;
      for (const [id, fields] of events) {
        const timestampField = fields.find((f, i) => fields[i - 1] === 'timestamp');
        if (timestampField && parseInt(timestampField) < cutoffTime) {
          await redis.xdel(this.streamName, id);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old events from stream`);
      }
    } catch (error) {
      logger.error('Failed to cleanup old events:', error);
    }
  }
}

// 싱글톤 인스턴스
let eventStreamInstance: EventStream | null = null;

/**
 * EventStream 싱글톤 인스턴스 가져오기
 */
export function getEventStream(): EventStream {
  if (!eventStreamInstance) {
    eventStreamInstance = new EventStream();
  }
  return eventStreamInstance;
}

