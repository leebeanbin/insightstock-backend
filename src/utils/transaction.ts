/**
 * Prisma 트랜잭션 유틸리티
 * 
 * 기술적 배경:
 * 1. ACID 보장: 여러 데이터베이스 작업을 하나의 원자적 단위로 묶어
 *    - Atomicity: 모든 작업이 성공하거나 모두 실패
 *    - Consistency: 데이터베이스가 항상 일관된 상태 유지
 *    - Isolation: 동시 실행되는 트랜잭션 간 간섭 방지
 *    - Durability: 커밋된 변경사항은 영구적으로 저장
 * 
 * 2. Prisma Interactive Transactions:
 *    - Prisma 4.7+에서 지원하는 트랜잭션 방식
 *    - 비동기 함수를 트랜잭션으로 래핑
 *    - 타임아웃 설정 가능 (기본 5초, 최대 60초)
 *    - 자동 롤백: 에러 발생 시 모든 변경사항 취소
 * 
 * 3. 사용 시나리오:
 *    - 여러 테이블에 동시에 데이터를 쓰는 경우
 *    - 데이터 일관성이 중요한 비즈니스 로직
 *    - 외래 키 제약 조건을 만족해야 하는 경우
 *    - 동시성 문제를 방지해야 하는 경우
 * 
 * 4. 성능 고려사항:
 *    - 트랜잭션은 데이터베이스 연결을 점유하므로 최소한의 시간만 사용
 *    - 읽기 전용 작업은 트랜잭션 밖에서 수행
 *    - 타임아웃을 적절히 설정하여 데드락 방지
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { DatabaseError } from '../errors/AppError';

/**
 * 트랜잭션 타임아웃 설정 (밀리초)
 * - 기본: 5초 (5000ms)
 * - 복잡한 작업: 10초 (10000ms)
 * - 최대: 60초 (Prisma 제한)
 */
export const TRANSACTION_TIMEOUT = {
  DEFAULT: 5000,
  COMPLEX: 10000,
  MAX: 60000,
} as const;

/**
 * 트랜잭션 실행 유틸리티 함수
 * 
 * @param callback 트랜잭션 내에서 실행할 비동기 함수
 * @param timeout 트랜잭션 타임아웃 (밀리초, 기본 5초)
 * @returns 트랜잭션 결과
 * 
 * @example
 * ```typescript
 * const result = await executeTransaction(async (tx) => {
 *   const stock = await stockRepository.findById(id, tx);
 *   const favorite = await favoriteRepository.create({ ... }, tx);
 *   return { stock, favorite };
 * });
 * ```
 */
export async function executeTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  timeout: number = TRANSACTION_TIMEOUT.DEFAULT
): Promise<T> {
  try {
    return await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        return await callback(tx);
      },
      {
        maxWait: timeout, // 트랜잭션 시작 대기 시간
        timeout: timeout, // 트랜잭션 실행 최대 시간
      }
    );
  } catch (error) {
    // Prisma 트랜잭션 에러 처리
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // 데드락 감지
      if (error.code === 'P2034') {
        logger.warn('Transaction deadlock detected, retrying...');
        // 재시도 로직 (선택적)
        throw new DatabaseError('Transaction conflict. Please try again.');
      }
      
      // 타임아웃
      if (error.code === 'P2028') {
        logger.error('Transaction timeout exceeded');
        throw new DatabaseError('Transaction timeout. The operation took too long.');
      }
      
      // 외래 키 제약 조건 위반
      if (error.code === 'P2003') {
        logger.error('Foreign key constraint violation in transaction');
        throw new DatabaseError('Invalid reference. Related record does not exist.');
      }
    }
    
    // 일반 에러는 그대로 전파
    logger.error('Transaction error:', error);
    throw error;
  }
}

/**
 * 트랜잭션이 필요한 작업인지 판단하는 헬퍼
 * 
 * 기술적 이유:
 * - 여러 Repository 호출이 하나의 비즈니스 로직 단위인 경우
 * - 데이터 일관성이 중요한 경우 (예: Stock 조회 + Favorite 생성)
 * - 외래 키 제약 조건을 만족해야 하는 경우
 */
export function requiresTransaction(operations: number): boolean {
  // 2개 이상의 쓰기 작업이 있으면 트랜잭션 필요
  return operations >= 2;
}

