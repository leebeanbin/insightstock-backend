/**
 * Rate Limiting Middleware
 * API 호출 제한을 위한 미들웨어
 */

import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { redis } from '../config/redis';

export const setupRateLimit = async (fastify: FastifyInstance) => {
  // Redis를 사용한 Rate Limiting
  await fastify.register(rateLimit, {
    max: 100, // 최대 요청 수
    timeWindow: '1 minute', // 시간 창
    redis: redis, // Redis 클라이언트 사용
    nameSpace: 'rate-limit:', // Redis 키 네임스페이스
    continueExceeding: false, // 제한 초과 시 요청 거부
    skipOnError: true, // Redis 에러 시 Rate Limit 비활성화 (서비스 중단 방지)
  });

  // 채팅 API에 대한 더 엄격한 Rate Limiting
  fastify.addHook('onRequest', async (request, reply) => {
    // 채팅 스트리밍 엔드포인트는 더 엄격한 제한
    if (request.url.includes('/api/chat/stream')) {
      const userId = (request as any).userId;
      if (userId) {
        const key = `rate-limit:chat:${userId}`;
        const count = await redis.incr(key);
        await redis.expire(key, 60); // 1분

        if (count > 10) {
          // 사용자당 1분에 10회 제한
          reply.code(429).send({
            success: false,
            error: 'Too many requests. Please wait a moment.',
            retryAfter: 60,
          });
          return;
        }
      }
    }
  });
};

