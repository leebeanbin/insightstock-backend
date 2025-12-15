/**
 * 에러 처리 유틸리티
 * 일관된 에러 처리 패턴 제공
 */

import { Prisma } from '@prisma/client';
import { logger } from '../config/logger';
import { DatabaseError, NotFoundError, ConflictError, ValidationError } from '../errors/AppError';

/**
 * Prisma 에러를 AppError로 변환
 */
export function handlePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        throw new ConflictError('Resource already exists');
      case 'P2025':
        // Record not found
        throw new NotFoundError('Resource');
      case 'P2003':
        // Foreign key constraint violation
        throw new ValidationError('Invalid reference');
      default:
        logger.error('Prisma error:', error);
        throw new DatabaseError(`Database operation failed: ${error.code}`);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    logger.error('Prisma validation error:', error);
    throw new ValidationError('Invalid data format');
  }

  // 알 수 없는 Prisma 에러
  logger.error('Unknown Prisma error:', error);
  throw new DatabaseError('Database operation failed');
}

/**
 * 에러를 안전하게 처리하고 로깅
 * 치명적이지 않은 에러의 경우 기본값 반환
 */
export function handleNonCriticalError<T>(
  error: unknown,
  defaultValue: T,
  context: string
): T {
  logger.warn(`${context} (non-critical):`, error);
  return defaultValue;
}

/**
 * 에러를 로깅하고 재전파
 * 시스템 에러의 경우 사용
 */
export function handleSystemError(error: unknown, context: string): never {
  logger.error(`${context} error:`, error);
  
  // 이미 AppError면 그대로 전파
  if (error instanceof Error && 'statusCode' in error) {
    throw error;
  }

  // Prisma 에러면 변환
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(error);
  }

  // 기타 에러는 DatabaseError로 래핑
  throw new DatabaseError(`Operation failed: ${context}`);
}
