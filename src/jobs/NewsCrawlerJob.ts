/**
 * News Crawler Job
 * RSS 뉴스 크롤링 작업
 * Scheduled 데코레이터를 사용한 어노테이션 기반 스케줄링
 */

import { Scheduled } from '../decorators/scheduled';
import { PipelineBranch } from '../pipelines/PipelineManager';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';

export class NewsCrawlerJob {
  /**
   * 뉴스 크롤링 작업
   * 5분마다 실행
   */
  @Scheduled({
    cron: '0 */5 * * *', // 5분마다
    name: 'news-crawler',
    branch: PipelineBranch.DATA,
    enabled: true,
    priority: 10,
    timeout: 300000, // 5분 타임아웃
    retries: 2,
  })
  async crawlNews() {
    logger.info('News crawler job started');
    
    try {
      // TODO: 실제 RSS 크롤링 로직 구현
      // 1. Active 소스 조회
      // 2. RSS 파싱
      // 3. 중복 체크
      // 4. News 저장
      // 5. AI 분석 큐 추가
      
      logger.info('News crawler job completed');
    } catch (error) {
      logger.error('News crawler job failed:', error);
      throw error;
    }
  }
}

