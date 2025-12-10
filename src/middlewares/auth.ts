import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { extractTokenFromHeader, verifyToken } from '../utils/jwt';
import { UnauthorizedError } from '../errors/AppError';

// Extend FastifyRequest to include userId
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

// Extend Express Request to include userId (for Controllers)
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Authentication hook for Fastify
 * 
 * STUB 상태: 현재는 개발용 더미 사용
 * JWT 인증 구현 완료 후 verifyTokenFromRequest()로 교체 예정
 */
export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    // STUB: 개발용 더미 사용
    // TODO: 개발 완료 후 verifyTokenFromRequest()로 교체
    const dummyUserId = 'dev-user-001';
    request.userId = dummyUserId;
    logger.debug(`Auth middleware: Using dummy userId ${dummyUserId}`);

    // 실제 JWT 인증 (주석 처리 - 개발 완료 후 활성화)
    // const token = extractTokenFromHeader(request.headers.authorization);
    // if (!token) {
    //   throw new UnauthorizedError('No token provided');
    // }
    // const payload = verifyToken(token); // verifyToken이 UnauthorizedError를 throw함
    // request.userId = payload.userId;
  } catch (error) {
    // 에러를 throw하여 글로벌 에러 핸들러가 처리하도록 함
    logger.error('Auth middleware error:', error);
    throw error;
  }
};

/**
 * Optional authentication hook
 * Continues even if no auth token is provided
 */
export const optionalAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    // STUB: 개발용 더미 사용
    const dummyUserId = 'dev-user-001';
    request.userId = dummyUserId;

    // 실제 JWT 인증 (주석 처리 - 개발 완료 후 활성화)
    // const token = extractTokenFromHeader(request.headers.authorization);
    // if (token) {
    //   try {
    //     const payload = verifyToken(token); // verifyToken이 UnauthorizedError를 throw할 수 있음
    //     request.userId = payload.userId;
    //   } catch (error) {
    //     // optionalAuth는 토큰이 유효하지 않아도 계속 진행
    //     logger.debug('Optional auth: Invalid token, proceeding without userId');
    //   }
    // }
  } catch (error) {
    // Continue without userId
    logger.debug('Optional auth: No userId set');
  }
};

/**
 * JWT 토큰 검증 헬퍼 함수 (STUB)
 * 
 * 개발 완료 후 authenticate()에서 사용할 함수
 */
function verifyTokenFromRequest(request: FastifyRequest): string {
  const token = extractTokenFromHeader(request.headers.authorization);
  if (!token) {
    throw new UnauthorizedError('No token provided');
  }

  const payload = verifyToken(token); // verifyToken이 UnauthorizedError를 throw함
  return payload.userId;
}
