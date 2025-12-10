/**
 * Prisma Middleware
 * 자동 캐시 무효화 및 쿼리 로깅
 * 
 * 기능:
 * 1. update/delete/create 시 관련 캐시 자동 무효화
 * 2. 쿼리 성능 추적
 * 3. 느린 쿼리 감지
 */

import { Prisma } from '@prisma/client';
import { cacheService } from '../services/CacheService';
import { logger } from './logger';

/**
 * Prisma Middleware 설정
 * @param prisma PrismaClient 인스턴스
 */
export function setupPrismaMiddleware(prisma: any) {
  // 캐시 무효화 미들웨어
  prisma.$use(async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => {
    const startTime = Date.now();
    const { model, action, args } = params;
    
    // 쿼리 실행
    const result = await next(params);
    
    const duration = Date.now() - startTime;
    
    // 느린 쿼리 감지 (1초 이상)
    if (duration > 1000) {
      logger.warn(`Slow query detected: ${model}.${action} - ${duration}ms`, {
        model,
        action,
        duration,
      });
    }
    
    // 업데이트/삭제/생성 시 캐시 무효화
    if (action === 'update' || action === 'delete' || action === 'create') {
      if (model) {
        try {
          // 모델별 캐시 패턴 삭제
          await cacheService.deletePattern(`${model}:*`);
          
          // 특정 ID가 있으면 해당 캐시도 삭제
          if (args?.where?.id) {
            await cacheService.delete(`${model}:${args.where.id}`);
          }
          
          // userId가 있으면 사용자별 캐시도 삭제
          if (args?.where?.userId) {
            await cacheService.deletePattern(`${model}:*:${args.where.userId}*`);
            await cacheService.deletePattern(`${model}:list:${args.where.userId}*`);
          }
          
          // 특정 필드 기반 캐시 삭제 (예: code, stockId 등)
          if (args?.where?.code) {
            await cacheService.delete(`${model}:${args.where.code}`);
          }
          
          if (args?.where?.stockId) {
            await cacheService.deletePattern(`${model}:*:${args.where.stockId}*`);
          }
          
          logger.debug(`Cache invalidated for ${model}.${action}`, {
            model,
            action,
            where: args?.where,
          });
        } catch (error) {
          // 캐시 무효화 실패는 로그만 남기고 계속 진행
          logger.error(`Failed to invalidate cache for ${model}.${action}:`, error);
        }
      }
    }
    
    return result;
  });
  
  logger.info('Prisma middleware configured: cache invalidation & query logging');
}

