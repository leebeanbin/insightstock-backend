/**
 * Jobs Index
 * 모든 백그라운드 작업을 여기서 등록
 * Scheduled 데코레이터를 사용한 작업들은 자동으로 등록됨
 */

import { getPipelineManager, PipelineBranch } from '../pipelines/PipelineManager';
import { logger } from '../config/logger';
import { registerScheduledJobs } from '../decorators/scheduled';

// Scheduled 데코레이터를 사용한 작업 클래스들 import
import { NewsCrawlerJob } from './NewsCrawlerJob';
import { CacheCleanupJob } from './CacheCleanupJob';
import { ImageCleanupJob } from './ImageCleanupJob';
import { DataCleanupJob } from './DataCleanupJob';

/**
 * 작업 등록 함수
 * Scheduled 데코레이터를 사용한 작업들은 자동으로 등록됨
 */
export async function registerAllJobs(): Promise<void> {
  const pipelineManager = getPipelineManager();

  // Scheduled 데코레이터를 사용한 작업 클래스들 등록
  await registerScheduledJobs(NewsCrawlerJob);
  await registerScheduledJobs(CacheCleanupJob);
  await registerScheduledJobs(ImageCleanupJob);
  await registerScheduledJobs(DataCleanupJob);

  // 수동으로 등록해야 하는 작업들 (Scheduled 데코레이터 미사용)
  // 예: 동적으로 생성되는 작업, 조건부 작업 등

  logger.info('All jobs registered (Scheduled decorator + manual)');
}

/**
 * 브랜치별 작업 실행
 */
export async function executeBranchJobs(branch: PipelineBranch): Promise<void> {
  const pipelineManager = getPipelineManager();
  await pipelineManager.executeBranch(branch);
}

