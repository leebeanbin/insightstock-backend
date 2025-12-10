/**
 * 성능 측정 미들웨어 (AOP 기반)
 * 
 * 목적:
 * 1. API 요청/응답 시간 측정
 * 2. 레이어별 실행 시간 추적
 * 3. 병목 지점 감지 및 로깅
 * 
 * 기술적 배경:
 * - Fastify Hook을 사용하여 요청/응답 라이프사이클에 훅
 * - Request ID를 생성하여 요청 추적
 * - 레이어별 실행 시간을 측정하여 병목 지점 식별
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { createLayerTracker } from '../utils/aop';

/**
 * 요청 ID 생성 (UUID v4 형식)
 */
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 성능 측정을 위한 Request 속성 확장
 */
declare module 'fastify' {
  interface FastifyRequest {
    requestId?: string;
    startTime?: number;
    layerTracker?: ReturnType<typeof createLayerTracker>;
  }
}

/**
 * API 실행 시간 측정 Hook
 * 
 * 사용법:
 * ```typescript
 * app.addHook('onRequest', performanceTracking);
 * app.addHook('onResponse', performanceTracking);
 * ```
 */
export async function performanceTracking(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 요청 시작 시
  if (!request.requestId) {
    request.requestId = generateRequestId();
    request.startTime = Date.now();
    request.layerTracker = createLayerTracker(request.requestId);

    // 요청 정보 로깅
    logger.info(
      `▶ [${request.requestId}] ${request.method} ${request.url} - 시작`
    );
  } else {
    // 응답 완료 시
    const duration = Date.now() - (request.startTime || 0);
    const statusCode = reply.statusCode;

    // 레이어별 메트릭 리포트
    if (request.layerTracker) {
      request.layerTracker.finish();
    }

    // 응답 정보 로깅
    const logLevel = duration > 2000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    logger[logLevel](
      `✓ [${request.requestId}] ${request.method} ${request.url} - ${statusCode} - ${duration}ms`
    );

    // 병목 감지
    if (duration > 2000) {
      logger.warn(
        `⚠ [${request.requestId}] API 병목 감지: ${duration}ms (${request.method} ${request.url})`
      );
    }
  }
}

/**
 * 레이어별 실행 시간 기록 헬퍼
 * 
 * @example
 * ```typescript
 * // Controller에서
 * recordLayerTime(request, 'controller', () => {
 *   // controller 로직
 * });
 * ```
 */
export function recordLayerTime<T>(
  request: FastifyRequest,
  layer: 'controller' | 'service' | 'repository' | 'database',
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  return fn().finally(() => {
    const duration = Date.now() - startTime;
    if (request.layerTracker) {
      request.layerTracker.recordLayer(layer, duration);
    }
  });
}

/**
 * 성능 측정 미들웨어 등록
 * 
 * @param app Fastify 인스턴스
 */
export function setupPerformanceTracking(app: any): void {
  // 요청 시작 시
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    request.requestId = generateRequestId();
    request.startTime = Date.now();
    request.layerTracker = createLayerTracker(request.requestId);

    logger.info(
      `▶ [${request.requestId}] ${request.method} ${request.url} - 시작`
    );
  });

  // 응답 완료 시
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = Date.now() - (request.startTime || 0);
    const statusCode = reply.statusCode;

    // 레이어별 메트릭 리포트
    if (request.layerTracker) {
      request.layerTracker.finish();
    }

    // 응답 정보 로깅
    const logLevel = duration > 2000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    logger[logLevel](
      `✓ [${request.requestId}] ${request.method} ${request.url} - ${statusCode} - ${duration}ms`
    );

    // 병목 감지
    if (duration > 2000) {
      logger.warn(
        `⚠ [${request.requestId}] API 병목 감지: ${duration}ms (${request.method} ${request.url})`
      );
    }
  });
}

