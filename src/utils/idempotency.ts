import { createHash } from 'crypto';

/**
 * Idempotency Key 생성
 *
 * 동일한 요청이 여러 번 들어와도 한 번만 처리되도록 보장
 *
 * @param userId 사용자 ID
 * @param operation 작업 종류 (예: 'create-note')
 * @param params 고유 파라미터 (title, newsId 등)
 * @returns 고유 키
 */
export function generateIdempotencyKey(
  userId: string,
  operation: string,
  params: Record<string, any>
): string {
  // 파라미터를 정렬하여 일관된 해시 생성
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, any>);

  const data = JSON.stringify({
    userId,
    operation,
    params: sortedParams,
  });

  return createHash('sha256').update(data).digest('hex');
}

/**
 * In-memory Idempotency 캐시
 * 실제 프로덕션에서는 Redis를 사용해야 함
 */
class IdempotencyCache {
  private cache = new Map<string, { result: any; timestamp: number }>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 5 * 60 * 1000) {
    // 기본 5분
    this.ttlMs = ttlMs;

    // 주기적으로 만료된 항목 정리
    setInterval(() => this.cleanup(), 60 * 1000); // 1분마다
  }

  /**
   * 캐시에서 결과 조회
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // TTL 체크
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.result as T;
  }

  /**
   * 캐시에 결과 저장
   */
  set(key: string, result: any): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * 만료된 항목 정리
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 캐시 크기 조회
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 캐시 초기화
   */
  clear(): void {
    this.cache.clear();
  }
}

// 싱글톤 인스턴스
export const idempotencyCache = new IdempotencyCache();

/**
 * Idempotent 함수 실행
 *
 * @param key Idempotency Key
 * @param fn 실행할 함수
 * @returns 함수 실행 결과 (캐시된 결과 또는 새로 실행)
 */
export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // 캐시 확인
  const cached = idempotencyCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // 함수 실행
  const result = await fn();

  // 결과 캐싱
  idempotencyCache.set(key, result);

  return result;
}
