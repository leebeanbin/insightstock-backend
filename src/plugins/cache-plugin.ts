/**
 * Fastify Cache Plugin
 * 라우트 레벨 자동 캐싱
 * 
 * 사용 예시:
 * ```typescript
 * fastify.get('/stocks', {
 *   preHandler: fastify.cache(60), // 1분 캐시
 * }, async (request, reply) => {
 *   return await stockService.getStocks();
 * });
 * ```
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { cacheService } from '../services/CacheService';
import { logger } from '../config/logger';

/**
 * 캐시 키 생성
 */
function generateCacheKey(method: string, url: string, query?: any): string {
  const queryString = query ? JSON.stringify(query) : '';
  return `route:${method}:${url}${queryString ? `:${queryString}` : ''}`;
}

/**
 * Cache Plugin
 */
const cachePlugin: FastifyPluginAsync = async (fastify) => {
  /**
   * 캐싱 미들웨어 데코레이터
   * @param ttl 캐시 TTL (초)
   * @param keyGenerator 커스텀 캐시 키 생성 함수 (선택)
   */
  fastify.decorate('cache', function(ttl: number = 60, keyGenerator?: (request: FastifyRequest) => string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // 캐시 키 생성
      const cacheKey = keyGenerator 
        ? keyGenerator(request)
        : generateCacheKey(request.method, request.url, request.query);
      
      try {
        // 캐시 확인
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          logger.debug(`Route cache hit: ${cacheKey}`);
          return reply.send(cached);
        }
        
        logger.debug(`Route cache miss: ${cacheKey}`);
        
        // 원본 send 메서드 저장
        const originalSend = reply.send.bind(reply);
        
        // send 메서드 오버라이드하여 결과 캐싱
        reply.send = function(data: any) {
          // 성공 응답만 캐싱 (2xx 상태 코드)
          if (reply.statusCode >= 200 && reply.statusCode < 300) {
            cacheService.set(cacheKey, data, ttl).catch((error) => {
              logger.error(`Failed to cache route response for ${cacheKey}:`, error);
            });
            logger.debug(`Route cache set: ${cacheKey} (TTL: ${ttl}s)`);
          }
          
          return originalSend(data);
        };
      } catch (error) {
        // 캐시 실패 시에도 요청은 계속 진행
        logger.error(`Cache plugin error for ${cacheKey}:`, error);
      }
    };
  });
  
  // 타입 정의
  fastify.decorateRequest('cacheKey', null);
  
  logger.info('Cache plugin registered');
};

export default fp(cachePlugin, {
  name: 'cache-plugin',
  fastify: '5.x',
  encapsulate: false, // 전역적으로 사용 가능하도록 설정
});

// TypeScript 타입 정의
declare module 'fastify' {
  interface FastifyInstance {
    cache(ttl?: number, keyGenerator?: (request: FastifyRequest) => string): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  
  interface FastifyRequest {
    cacheKey?: string;
  }
}

