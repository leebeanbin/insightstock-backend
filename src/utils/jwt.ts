/**
 * JWT Utility Functions (STUB)
 * 
 * TODO: Implement full JWT authentication when development is complete
 * 
 * 현재는 스탠바이 상태로, 나중에 쉽게 교체할 수 있도록 구조만 준비
 */

import jwt from 'jsonwebtoken';
import { logger } from '../config/logger';
import { UnauthorizedError, AppError } from '../errors/AppError';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  email?: string;
  role?: string;
}

/**
 * JWT 토큰 생성 (STUB)
 * 
 * @param payload - JWT 페이로드
 * @returns JWT 토큰 문자열
 */
export function generateToken(payload: JWTPayload): string {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  } catch (error) {
    logger.error('JWT token generation error:', error);
    throw new AppError(500, 'Failed to generate token');
  }
}

/**
 * JWT 토큰 검증 (STUB)
 * 
 * @param token - JWT 토큰 문자열
 * @returns 검증된 페이로드
 * @throws UnauthorizedError 토큰이 유효하지 않거나 만료된 경우
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    logger.debug('JWT token verification failed:', error);
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/**
 * Authorization 헤더에서 토큰 추출
 * 
 * @param authHeader - Authorization 헤더 값 (예: "Bearer <token>")
 * @returns 토큰 문자열 또는 null
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

