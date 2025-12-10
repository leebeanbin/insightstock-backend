/**
 * Fastify Validation Plugin
 * Zod 스키마를 사용한 요청/응답 검증
 * 
 * 주의: Fastify의 기본 스키마 검증과 충돌을 피하기 위해
 * Zod 스키마는 preHandler에서 수동으로 검증합니다.
 */

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../config/logger';

/**
 * Validation Plugin
 */
const validationPlugin: FastifyPluginAsync = async (fastify) => {
  logger.info('Validation plugin registered (Zod schema support)');
};

export default fp(validationPlugin, {
  name: 'validation-plugin',
  fastify: '5.x',
  encapsulate: false,
});

// TypeScript 타입 정의 확장
declare module 'fastify' {
  interface FastifyContextConfig {
    zodSchema?: {
      params?: ZodSchema;
      query?: ZodSchema;
      body?: ZodSchema;
      headers?: ZodSchema;
    };
  }
}

