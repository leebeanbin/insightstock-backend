/**
 * Cache Cleanup Job
 * 오래된 캐시 정리 작업
 */

import { Scheduled } from '../decorators/scheduled';
import { PipelineBranch } from '../pipelines/PipelineManager';
import { logger } from '../config/logger';
import { cacheService } from '../services/CacheService';

export class CacheCleanupJob {
  /**
   * 캐시 정리 작업
   * 6시간마다 실행
   */
  @Scheduled({
    cron: '0 */6 * * *', // 6시간마다
    name: 'cache-cleanup',
    branch: PipelineBranch.CACHE,
    enabled: true,
    priority: 5,
    timeout: 600000, // 10분 타임아웃
  })
  async cleanupCache() {
    logger.info('Cache cleanup job started');
    
    try {
      // TODO: 오래된 캐시 정리 로직 구현
      // Redis의 TTL이 만료된 키는 자동으로 삭제되지만,
      // 패턴 기반 캐시 정리나 통계 수집 등 추가 작업 가능
      
      logger.info('Cache cleanup job completed');
    } catch (error) {
      logger.error('Cache cleanup job failed:', error);
      throw error;
    }
  }
}

