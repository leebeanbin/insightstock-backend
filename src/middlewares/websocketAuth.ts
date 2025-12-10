/**
 * WebSocket Authentication Middleware
 * WebSocket 연결 시 인증 처리
 */

import { FastifyRequest } from 'fastify';
import { logger } from '../config/logger';
import { extractTokenFromHeader, verifyToken } from '../utils/jwt';
import { UnauthorizedError } from '../errors/AppError';

/**
 * WebSocket 연결 인증
 * 쿼리 파라미터 또는 헤더에서 토큰 추출
 */
export const authenticateWebSocket = (request: FastifyRequest): string => {
  try {
    // STUB: 개발용 더미 사용
    // TODO: 개발 완료 후 실제 JWT 검증으로 교체
    const dummyUserId = 'dev-user-001';
    logger.debug(`WebSocket auth: Using dummy userId ${dummyUserId}`);
    return dummyUserId;

    // 실제 JWT 인증 (주석 처리 - 개발 완료 후 활성화)
    // const token = 
    //   (request.query as any)?.token || 
    //   extractTokenFromHeader(request.headers.authorization);
    // 
    // if (!token) {
    //   throw new UnauthorizedError('No token provided');
    // }
    // 
    // const payload = verifyToken(token);
    // return payload.userId;
  } catch (error) {
    logger.error('WebSocket auth error:', error);
    throw new UnauthorizedError('WebSocket authentication failed');
  }
};

