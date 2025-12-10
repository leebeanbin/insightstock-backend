import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * 표준 응답 형식
 */
export interface StandardResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  requestId?: string;
  timestamp?: string;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  };
}

/**
 * Request/Response Interceptor
 * Spring Boot의 Filter와 유사한 역할 수행
 *
 * 기능:
 * 1. Request ID 생성 및 추적
 * 2. 요청/응답 로깅
 * 3. 응답 형식 표준화
 * 4. 성능 측정
 */
export const setupResponseInterceptor = (app: FastifyInstance) => {
  /**
   * onRequest Hook: 요청이 들어올 때 실행
   * - Request ID 생성
   * - 요청 시작 시간 기록
   * - 요청 정보 로깅
   */
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Request ID 생성 (분산 추적용)
    const requestId = uuidv4();
    (request as any).requestId = requestId;
    (request as any).startTime = Date.now();

    // Request 로깅
    logger.info({
      type: 'REQUEST',
      requestId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: (request as any).userId || 'anonymous',
    });
  });

  /**
   * onSend Hook: 응답을 보내기 직전 실행
   * - 응답 형식 표준화
   * - Response 로깅
   */
  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    const requestId = (request as any).requestId;
    const startTime = (request as any).startTime;
    const duration = Date.now() - startTime;

    // 이미 표준화된 응답이거나 SSE/WebSocket/파일 다운로드는 건드리지 않음
    const contentType = reply.getHeader('content-type');
    if (
      typeof contentType === 'string' &&
      (contentType.includes('text/event-stream') ||
        contentType.includes('application/octet-stream') ||
        contentType.includes('image/'))
    ) {
      return payload;
    }

    // Health check는 건드리지 않음
    if (request.url === '/health') {
      return payload;
    }

    try {
      const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;

      // 이미 표준 형식이면 requestId와 timestamp만 추가
      if (parsedPayload && typeof parsedPayload === 'object' && 'success' in parsedPayload) {
        const standardized = {
          ...parsedPayload,
          requestId,
          timestamp: new Date().toISOString(),
        };

        // Response 로깅
        logger.info({
          type: 'RESPONSE',
          requestId,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          duration: `${duration}ms`,
          success: standardized.success,
        });

        return JSON.stringify(standardized);
      }

      // 표준 형식이 아니면 래핑
      const standardized: StandardResponse = {
        success: reply.statusCode >= 200 && reply.statusCode < 300,
        data: parsedPayload,
        requestId,
        timestamp: new Date().toISOString(),
      };

      // Response 로깅
      logger.info({
        type: 'RESPONSE',
        requestId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration: `${duration}ms`,
        success: standardized.success,
      });

      return JSON.stringify(standardized);
    } catch (error) {
      // JSON 파싱 실패 시 원본 반환
      logger.warn({
        type: 'RESPONSE_PARSE_ERROR',
        requestId,
        error: (error as Error).message,
      });
      return payload;
    }
  });

  /**
   * onError Hook: 에러 발생 시 실행
   * - 에러 로깅
   * - 에러 응답 표준화는 error-handler에서 처리
   */
  app.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const requestId = (request as any).requestId;
    const startTime = (request as any).startTime;
    const duration = Date.now() - startTime;

    // 연결 에러는 debug 레벨로 (클라이언트가 연결을 끊은 경우)
    if ((error as any)?.code === 'ECONNRESET' || (error as any)?.code === 'EPIPE') {
      logger.debug({
        type: 'CONNECTION_ERROR',
        requestId,
        method: request.method,
        url: request.url,
        error: (error as any)?.code,
        duration: `${duration}ms`,
      });
      return;
    }

    // 에러 로깅
    logger.error({
      type: 'ERROR',
      requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode || 500,
      duration: `${duration}ms`,
      error: {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      userId: (request as any).userId || 'anonymous',
    });
  });

  logger.info('Response Interceptor initialized');
};
