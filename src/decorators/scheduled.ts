/**
 * Scheduled Decorator
 * 어노테이션 기반 Cron Job 스케줄링
 */

import { PipelineBranch, getPipelineManager } from '../pipelines/PipelineManager';
import { logger } from '../config/logger';
import { Queue } from 'bullmq';
import { redis } from '../config/redis';

/**
 * Scheduled 옵션
 */
export interface ScheduledOptions {
  cron: string; // Cron 표현식
  name?: string; // 작업 이름 (기본값: 메서드명)
  branch?: PipelineBranch; // 파이프라인 브랜치
  timezone?: string; // 타임존 (기본값: 'Asia/Seoul')
  enabled?: boolean; // 활성화 여부 (기본값: true)
  priority?: number; // 우선순위 (기본값: 0)
  timeout?: number; // 타임아웃 (ms, 기본값: 5분)
  retries?: number; // 재시도 횟수 (기본값: 0)
  useQueue?: boolean; // BullMQ 큐 사용 여부 (기본값: false)
  queueName?: string; // 큐 이름 (useQueue가 true일 때)
}

/**
 * Scheduled 데코레이터
 */
export function Scheduled(options: ScheduledOptions) {
  return function (target: any, propertyKey: string, descriptor?: PropertyDescriptor) {
    const {
      cron,
      name = propertyKey,
      branch = PipelineBranch.DATA,
      timezone = 'Asia/Seoul',
      enabled = true,
      priority = 0,
      timeout = 300000, // 5분
      retries = 0,
      useQueue = false,
      queueName,
    } = options;

    // 메타데이터 저장
    if (!target.constructor._scheduledJobs) {
      target.constructor._scheduledJobs = [];
    }

    const jobId = `${target.constructor.name}.${propertyKey}`;
    
    target.constructor._scheduledJobs.push({
      jobId,
      method: propertyKey,
      cron,
      name,
      branch,
      timezone,
      enabled,
      priority,
      timeout,
      retries,
      useQueue,
      queueName: queueName || `scheduled:${jobId}`,
      target: target.constructor,
    });

    // 메타데이터만 저장하고, 실제 등록은 registerScheduledJobs에서 수행
    if (enabled) {
      logger.debug(`Scheduled job metadata registered: ${jobId} (${cron})`);
    }

    return descriptor;
  };
}

/**
 * 클래스의 모든 Scheduled 작업을 PipelineManager에 등록
 */
export async function registerScheduledJobs(target: any): Promise<void> {
  const scheduledJobs = target._scheduledJobs || [];
  const pipelineManager = getPipelineManager();
  
  for (const job of scheduledJobs) {
    if (!job.enabled) continue;
    
    // PipelineManager에 작업 등록
    pipelineManager.register({
      id: job.jobId,
      branch: job.branch,
      name: job.name,
      handler: async () => {
        const instance = new target();
        const method = instance[job.method];
        if (typeof method === 'function') {
          await method.call(instance);
        } else {
          logger.error(`Method ${job.method} not found in ${target.name}`);
        }
      },
      schedule: job.cron,
      priority: job.priority,
      enabled: job.enabled,
      timeout: job.timeout,
      retries: job.retries,
    });

    logger.info(`Scheduled job registered: ${job.jobId} (${job.cron})`);
  }
}

