import { logger } from '../config/logger';

/**
 * 재시도 옵션
 */
export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  exponentialBackoff?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * 재시도 로직을 가진 함수 실행
 *
 * @param fn 실행할 함수
 * @param options 재시도 옵션
 * @returns 함수 실행 결과
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 100,
    exponentialBackoff = true,
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // 마지막 시도였다면 에러를 던짐
      if (attempt === maxRetries) {
        logger.error('Retry exhausted', {
          maxRetries,
          lastError: lastError.message,
        });
        throw lastError;
      }

      // 재시도 콜백 실행
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      // 대기 시간 계산 (exponential backoff)
      const delay = exponentialBackoff
        ? delayMs * Math.pow(2, attempt)
        : delayMs;

      logger.warn('Retrying operation', {
        attempt: attempt + 1,
        maxRetries,
        delayMs: delay,
        error: lastError.message,
      });

      // 대기
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 이 코드는 실행되지 않지만 TypeScript를 위해 필요
  throw lastError!;
}

/**
 * 특정 에러만 재시도
 */
export async function withRetryOnError<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: Error) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 100,
    exponentialBackoff = true,
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // 재시도 가능한 에러가 아니면 바로 던짐
      if (!shouldRetry(lastError)) {
        logger.warn('Error is not retryable', {
          error: lastError.message,
        });
        throw lastError;
      }

      // 마지막 시도였다면 에러를 던짐
      if (attempt === maxRetries) {
        logger.error('Retry exhausted', {
          maxRetries,
          lastError: lastError.message,
        });
        throw lastError;
      }

      // 재시도 콜백 실행
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      // 대기 시간 계산
      const delay = exponentialBackoff
        ? delayMs * Math.pow(2, attempt)
        : delayMs;

      logger.warn('Retrying operation', {
        attempt: attempt + 1,
        maxRetries,
        delayMs: delay,
        error: lastError.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
