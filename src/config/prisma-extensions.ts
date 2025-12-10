/**
 * Prisma Client Extensions
 * 자동 캐싱이 포함된 Prisma Client 확장
 * 
 * 사용 예시:
 * ```typescript
 * const stock = await prisma.stock.findFirstWithCache(
 *   { where: { code: '005930' } },
 *   'stock:005930',
 *   60 // 1분 TTL
 * );
 * ```
 */

import { Prisma } from '@prisma/client';
import { cacheService } from '../services/CacheService';
import { logger } from './logger';

/**
 * 캐시 키 생성 헬퍼
 */
function generateCacheKey(model: string, key: string): string {
  return `${model}:${key}`;
}

/**
 * Prisma Client Extensions
 * 모든 모델에 findFirstWithCache, findManyWithCache 메서드 추가
 * query extension point를 사용하여 자동 캐시 무효화 및 쿼리 로깅
 */
export const prismaExtensions = Prisma.defineExtension({
  name: 'caching',
  query: {
    // 모든 쿼리에 대한 미들웨어 로직
    async $allOperations({ operation, model, args, query }) {
      const startTime = Date.now();
      
      // 쿼리 실행
      const result = await query(args);
      
      const duration = Date.now() - startTime;
      
      // 느린 쿼리 감지 (1초 이상)
      if (duration > 1000) {
        logger.warn(`Slow query detected: ${model}.${operation} - ${duration}ms`, {
          model,
          operation,
          duration,
        });
      }
      
      // 업데이트/삭제/생성 시 캐시 무효화
      if (operation === 'update' || operation === 'delete' || operation === 'create') {
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
            
            logger.debug(`Cache invalidated for ${model}.${operation}`, {
              model,
              operation,
              where: args?.where,
            });
          } catch (error) {
            // 캐시 무효화 실패는 로그만 남기고 계속 진행
            logger.error(`Failed to invalidate cache for ${model}.${operation}:`, error);
          }
        }
      }
      
      return result;
    },
  },
  model: {
    $allModels: {
      /**
       * findFirst with automatic caching
       */
      async findFirstWithCache<T, A>(
        this: T,
        args: A,
        cacheKey: string,
        ttl: number = 60
      ) {
        const context = Prisma.getExtensionContext(this);
        const modelName = (context as any).name || 'unknown';
        
        try {
          // 캐시 확인
          const cached = await cacheService.get(cacheKey);
          if (cached) {
            logger.debug(`Cache hit: ${cacheKey}`);
            return cached;
          }
          
          logger.debug(`Cache miss: ${cacheKey}`);
          
          // DB 조회
          const result = await (this as any).findFirst(args);
          
          // 결과가 있으면 캐시 저장
          if (result) {
            await cacheService.set(cacheKey, result, ttl);
            logger.debug(`Cache set: ${cacheKey} (TTL: ${ttl}s)`);
          }
          
          return result;
        } catch (error) {
          logger.error(`Prisma Extension findFirstWithCache error for ${cacheKey}:`, error);
          // 캐시 실패 시에도 DB 조회는 진행
          return await (this as any).findFirst(args);
        }
      },
      
      /**
       * findMany with automatic caching
       */
      async findManyWithCache<T, A>(
        this: T,
        args: A,
        cacheKey: string,
        ttl: number = 60
      ) {
        const context = Prisma.getExtensionContext(this);
        const modelName = (context as any).name || 'unknown';
        
        try {
          // 캐시 확인
          const cached = await cacheService.get(cacheKey);
          if (cached) {
            logger.debug(`Cache hit: ${cacheKey}`);
            return cached;
          }
          
          logger.debug(`Cache miss: ${cacheKey}`);
          
          // DB 조회
          const result = await (this as any).findMany(args);
          
          // 결과 캐시 저장
          await cacheService.set(cacheKey, result, ttl);
          logger.debug(`Cache set: ${cacheKey} (TTL: ${ttl}s)`);
          
          return result;
        } catch (error) {
          logger.error(`Prisma Extension findManyWithCache error for ${cacheKey}:`, error);
          // 캐시 실패 시에도 DB 조회는 진행
          return await (this as any).findMany(args);
        }
      },
      
      /**
       * findUnique with automatic caching
       */
      async findUniqueWithCache<T, A>(
        this: T,
        args: A,
        cacheKey: string,
        ttl: number = 60
      ) {
        const context = Prisma.getExtensionContext(this);
        const modelName = (context as any).name || 'unknown';
        
        try {
          // 캐시 확인
          const cached = await cacheService.get(cacheKey);
          if (cached) {
            logger.debug(`Cache hit: ${cacheKey}`);
            return cached;
          }
          
          logger.debug(`Cache miss: ${cacheKey}`);
          
          // DB 조회
          const result = await (this as any).findUnique(args);
          
          // 결과가 있으면 캐시 저장
          if (result) {
            await cacheService.set(cacheKey, result, ttl);
            logger.debug(`Cache set: ${cacheKey} (TTL: ${ttl}s)`);
          }
          
          return result;
        } catch (error) {
          logger.error(`Prisma Extension findUniqueWithCache error for ${cacheKey}:`, error);
          // 캐시 실패 시에도 DB 조회는 진행
          return await (this as any).findUnique(args);
        }
      },
    },
  },
});

