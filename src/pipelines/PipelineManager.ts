/**
 * Pipeline Manager
 * 중앙 관리형 작업 파이프라인 시스템
 * 브랜치 개념을 통한 작업 그룹화 및 의존성 관리
 */

import { logger } from '../config/logger';

/**
 * 파이프라인 브랜치
 */
export enum PipelineBranch {
  DATA = 'data',      // 데이터 수집/처리
  CACHE = 'cache',    // 캐시 관리
  IMAGE = 'image',    // 이미지 처리
  AI = 'ai',          // AI 처리
  CLEANUP = 'cleanup', // 정리 작업
}

/**
 * 파이프라인 작업 인터페이스
 */
export interface PipelineJob {
  id: string;
  branch: PipelineBranch;
  name: string;
  handler: () => Promise<void>;
  schedule?: string; // Cron 표현식
  dependencies?: string[]; // 의존성 작업 ID
  priority?: number; // 우선순위 (높을수록 먼저 실행)
  enabled: boolean;
  timeout?: number; // 타임아웃 (ms)
  retries?: number; // 재시도 횟수
}

/**
 * 작업 실행 상태
 */
export interface JobExecutionStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  error?: Error;
  retryCount?: number;
}

/**
 * Pipeline Manager
 * 모든 백그라운드 작업을 중앙에서 관리
 */
export class PipelineManager {
  private jobs: Map<string, PipelineJob> = new Map();
  private branches: Map<PipelineBranch, Set<string>> = new Map();
  private executionStatus: Map<string, JobExecutionStatus> = new Map();
  private isRunning: boolean = false;

  constructor() {
    // 브랜치별 Set 초기화
    Object.values(PipelineBranch).forEach((branch) => {
      this.branches.set(branch, new Set());
    });
    
    logger.info('PipelineManager initialized');
  }

  /**
   * 작업 등록
   */
  register(job: PipelineJob): void {
    if (this.jobs.has(job.id)) {
      logger.warn(`Job ${job.id} already registered, overwriting...`);
    }

    this.jobs.set(job.id, job);
    
    // 브랜치에 작업 추가
    if (!this.branches.has(job.branch)) {
      this.branches.set(job.branch, new Set());
    }
    this.branches.get(job.branch)!.add(job.id);
    
    logger.info(`Job registered: ${job.id} (branch: ${job.branch})`);
  }

  /**
   * 작업 등록 해제
   */
  unregister(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn(`Job ${jobId} not found`);
      return;
    }

    this.jobs.delete(jobId);
    this.branches.get(job.branch)?.delete(jobId);
    this.executionStatus.delete(jobId);
    
    logger.info(`Job unregistered: ${jobId}`);
  }

  /**
   * 브랜치별 작업 실행
   */
  async executeBranch(branch: PipelineBranch): Promise<void> {
    if (this.isRunning) {
      logger.warn(`Pipeline is already running, skipping branch ${branch}`);
      return;
    }

    this.isRunning = true;
    const jobIds = this.branches.get(branch) || new Set();
    const jobs = Array.from(jobIds)
      .map((id) => this.jobs.get(id)!)
      .filter((job) => job && job.enabled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0)); // 우선순위 높은 순

    logger.info(`Executing branch ${branch} with ${jobs.length} jobs`);

    try {
      await this.executeWithDependencies(jobs);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 의존성을 고려한 작업 실행
   */
  private async executeWithDependencies(jobs: PipelineJob[]): Promise<void> {
    const executed = new Set<string>();
    const failed = new Set<string>();

    const executeJob = async (job: PipelineJob): Promise<void> => {
      // 이미 실행되었거나 실패한 작업은 스킵
      if (executed.has(job.id) || failed.has(job.id)) {
        return;
      }

      // 의존성 먼저 실행
      if (job.dependencies && job.dependencies.length > 0) {
        for (const depId of job.dependencies) {
          const depJob = this.jobs.get(depId);
          if (depJob && !executed.has(depId)) {
            if (failed.has(depId)) {
              logger.warn(`Job ${job.id} skipped due to failed dependency ${depId}`);
              this.updateStatus(job.id, 'skipped', undefined, new Error(`Dependency ${depId} failed`));
              failed.add(job.id);
              return;
            }
            await executeJob(depJob);
          }
        }
      }

      // 본 작업 실행
      await this.runJob(job);
      executed.add(job.id);
    };

    // 모든 작업 실행
    for (const job of jobs) {
      if (!executed.has(job.id) && !failed.has(job.id)) {
        await executeJob(job);
      }
    }
  }

  /**
   * 단일 작업 실행
   */
  private async runJob(job: PipelineJob): Promise<void> {
    const startTime = new Date();
    this.updateStatus(job.id, 'running', startTime);

    logger.info(`Running job: ${job.id} (${job.name})`);

    try {
      // 타임아웃 설정
      const timeout = job.timeout || 300000; // 기본 5분
      
      const jobPromise = job.handler();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Job ${job.id} timed out after ${timeout}ms`)), timeout);
      });

      await Promise.race([jobPromise, timeoutPromise]);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      this.updateStatus(job.id, 'completed', startTime, endTime, duration);

      logger.info(`Job completed: ${job.id} (${job.name}) - ${duration}ms`);
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      const err = error as Error;

      // 재시도 로직
      const retries = job.retries || 0;
      const currentRetry = this.executionStatus.get(job.id)?.retryCount || 0;

      if (currentRetry < retries) {
        logger.warn(`Job ${job.id} failed, retrying... (${currentRetry + 1}/${retries})`);
        this.updateStatus(job.id, 'running', startTime, undefined, undefined, err, currentRetry + 1);
        
        // 재시도
        await new Promise((resolve) => setTimeout(resolve, 1000 * (currentRetry + 1))); // 지수 백오프
        return this.runJob(job);
      }

      this.updateStatus(job.id, 'failed', startTime, endTime, duration, err);
      logger.error(`Job failed: ${job.id} (${job.name}) - ${err.message}`);
    }
  }

  /**
   * 작업 상태 업데이트
   */
  private updateStatus(
    jobId: string,
    status: JobExecutionStatus['status'],
    startTime?: Date,
    endTime?: Date,
    duration?: number,
    error?: Error,
    retryCount?: number
  ): void {
    const current = this.executionStatus.get(jobId) || {} as JobExecutionStatus;
    
    this.executionStatus.set(jobId, {
      jobId,
      status,
      startTime: startTime || current.startTime,
      endTime: endTime || current.endTime,
      duration: duration || current.duration,
      error: error || current.error,
      retryCount: retryCount || current.retryCount || 0,
    });
  }

  /**
   * 작업 상태 조회
   */
  getJobStatus(jobId: string): JobExecutionStatus | null {
    return this.executionStatus.get(jobId) || null;
  }

  /**
   * 브랜치별 작업 목록 조회
   */
  getBranchJobs(branch: PipelineBranch): PipelineJob[] {
    const jobIds = this.branches.get(branch) || new Set();
    return Array.from(jobIds)
      .map((id) => this.jobs.get(id)!)
      .filter((job) => job !== undefined);
  }

  /**
   * 모든 작업 목록 조회
   */
  getAllJobs(): PipelineJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * 브랜치별 실행 통계
   */
  getBranchStats(branch: PipelineBranch): {
    total: number;
    enabled: number;
    completed: number;
    failed: number;
    running: number;
  } {
    const jobs = this.getBranchJobs(branch);
    const statuses = jobs.map((job) => this.executionStatus.get(job.id));

    return {
      total: jobs.length,
      enabled: jobs.filter((j) => j.enabled).length,
      completed: statuses.filter((s) => s?.status === 'completed').length,
      failed: statuses.filter((s) => s?.status === 'failed').length,
      running: statuses.filter((s) => s?.status === 'running').length,
    };
  }

  /**
   * 작업 활성화/비활성화
   */
  setJobEnabled(jobId: string, enabled: boolean): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn(`Job ${jobId} not found`);
      return;
    }

    job.enabled = enabled;
    logger.info(`Job ${jobId} ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// 싱글톤 인스턴스
let pipelineManagerInstance: PipelineManager | null = null;

/**
 * PipelineManager 싱글톤 인스턴스 가져오기
 */
export function getPipelineManager(): PipelineManager {
  if (!pipelineManagerInstance) {
    pipelineManagerInstance = new PipelineManager();
  }
  return pipelineManagerInstance;
}

