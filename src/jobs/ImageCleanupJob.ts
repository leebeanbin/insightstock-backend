/**
 * Image Cleanup Job
 * 사용되지 않는 이미지 정리 작업
 */

import { Scheduled } from '../decorators/scheduled';
import { PipelineBranch } from '../pipelines/PipelineManager';
import { logger } from '../config/logger';

export class ImageCleanupJob {
  /**
   * 이미지 정리 작업
   * 매일 새벽 2시 실행
   */
  @Scheduled({
    cron: '0 2 * * *', // 매일 새벽 2시
    name: 'image-cleanup',
    branch: PipelineBranch.IMAGE,
    enabled: true,
    priority: 3,
    timeout: 1800000, // 30분 타임아웃
  })
  async cleanupUnusedImages() {
    logger.info('Image cleanup job started');
    
    try {
      // TODO: 사용되지 않는 이미지 정리 로직 구현
      // 1. DB에서 참조되지 않는 이미지 파일 찾기
      // 2. 파일 시스템에서 삭제
      // 3. 로그 기록
      
      logger.info('Image cleanup job completed');
    } catch (error) {
      logger.error('Image cleanup job failed:', error);
      throw error;
    }
  }
}

