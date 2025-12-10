/**
 * Query Parameter Utilities
 * 쿼리 파라미터 파싱 및 검증 유틸리티
 */

/**
 * 쿼리 파라미터에서 정수 파싱
 */
export function parseQueryInt(
  value: string | undefined,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed)) return defaultValue;
  
  if (min !== undefined && parsed < min) return min;
  if (max !== undefined && parsed > max) return max;
  
  return parsed;
}

/**
 * 쿼리 파라미터에서 문자열 반환
 */
export function parseQueryString(value: string | undefined): string | undefined {
  return value || undefined;
}

/**
 * 쿼리 파라미터에서 불리언 파싱
 */
export function parseQueryBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

