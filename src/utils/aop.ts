/**
 * AOP (Aspect-Oriented Programming) 유틸리티
 * 
 * 목적:
 * 1. 메서드 실행 시간 측정
 * 2. 병목 지점 추적
 * 3. 실행 단계 로깅
 * 
 * 기술적 배경:
 * - AOP는 횡단 관심사(Cross-cutting Concerns)를 분리하는 패턴
 * - 로깅, 성능 측정, 트랜잭션 관리 등을 비즈니스 로직과 분리
 * - TypeScript에서는 Higher-Order Function으로 구현
 */

import { logger } from '../config/logger';

/**
 * 실행 시간 측정 결과
 */
export interface ExecutionMetrics {
  methodName: string;
  className?: string;
  duration: number; // 밀리초
  timestamp: Date;
  success: boolean;
  error?: Error;
}

/**
 * 병목 지점 추적을 위한 단계별 시간 측정
 */
export interface StepMetrics {
  step: string;
  duration: number;
  timestamp: Date;
}

/**
 * 메서드 실행 시간을 측정하고 로깅하는 AOP 래퍼
 * 
 * @param target 클래스 인스턴스 또는 함수
 * @param propertyKey 메서드 이름
 * @param descriptor 메서드 디스크립터
 * @param options 옵션 (로그 레벨, 병목 임계값 등)
 * 
 * @example
 * ```typescript
 * class MyService {
 *   @measureExecution({ threshold: 1000 })
 *   async myMethod() {
 *     // ...
 *   }
 * }
 * ```
 */
export function measureExecution(options: {
  threshold?: number; // 병목 임계값 (ms), 이 값보다 오래 걸리면 경고
  logLevel?: 'debug' | 'info' | 'warn';
  className?: string;
} = {}) {
  const {
    threshold = 1000, // 기본 1초
    logLevel = 'info',
    className,
  } = options;

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const startTimestamp = new Date();
      const methodName = `${className || target.constructor.name}.${propertyKey}`;
      
      // 실행 시작 로깅
      logger[logLevel](`▶ ${methodName} - 시작`);

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        const metrics: ExecutionMetrics = {
          methodName,
          className: className || target.constructor.name,
          duration,
          timestamp: startTimestamp,
          success: true,
        };

        // 병목 감지
        if (duration > threshold) {
          logger.warn(
            `⚠ ${methodName} - 병목 감지: ${duration}ms (임계값: ${threshold}ms)`
          );
        } else {
          logger[logLevel](`✓ ${methodName} - 완료: ${duration}ms`);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const metrics: ExecutionMetrics = {
          methodName,
          className: className || target.constructor.name,
          duration,
          timestamp: startTimestamp,
          success: false,
          error: error as Error,
        };

        logger.error(
          `✗ ${methodName} - 실패: ${duration}ms - ${(error as Error).message}`
        );
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 함수 실행 시간을 측정하는 Higher-Order Function
 * 
 * @param fn 실행할 함수
 * @param context 컨텍스트 정보 (클래스명, 메서드명 등)
 * @param options 옵션
 * 
 * @example
 * ```typescript
 * const wrappedFn = withMetrics(
 *   async () => { return await someOperation(); },
 *   { className: 'MyService', methodName: 'myMethod' },
 *   { threshold: 500 }
 * );
 * ```
 */
export function withMetrics<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: { className?: string; methodName: string },
  options: { threshold?: number; logLevel?: 'debug' | 'info' | 'warn' } = {}
): T {
  const { threshold = 1000, logLevel = 'info' } = options;
  const { className, methodName } = context;
  const fullMethodName = className ? `${className}.${methodName}` : methodName;

  return (async (...args: any[]) => {
    const startTime = Date.now();
    logger[logLevel](`▶ ${fullMethodName} - 시작`);

    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;

      if (duration > threshold) {
        logger.warn(
          `⚠ ${fullMethodName} - 병목 감지: ${duration}ms (임계값: ${threshold}ms)`
        );
      } else {
        logger[logLevel](`✓ ${fullMethodName} - 완료: ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        `✗ ${fullMethodName} - 실패: ${duration}ms - ${(error as Error).message}`
      );
      throw error;
    }
  }) as T;
}

/**
 * 단계별 실행 시간을 추적하는 유틸리티
 * 
 * @example
 * ```typescript
 * const tracker = createStepTracker('MyService.myMethod');
 * tracker.step('DB 조회 시작');
 * const data = await db.find();
 * tracker.step('DB 조회 완료');
 * tracker.step('비즈니스 로직 시작');
 * // ...
 * tracker.finish();
 * ```
 */
export function createStepTracker(context: string) {
  const steps: StepMetrics[] = [];
  const startTime = Date.now();
  let lastStepTime = startTime;

  return {
    /**
     * 단계 기록
     */
    step(stepName: string): void {
      const now = Date.now();
      const stepDuration = now - lastStepTime;
      const totalDuration = now - startTime;

      steps.push({
        step: stepName,
        duration: stepDuration,
        timestamp: new Date(),
      });

      logger.debug(
        `  └─ ${context} [${stepName}] - ${stepDuration}ms (총 ${totalDuration}ms)`
      );

      lastStepTime = now;
    },

    /**
     * 전체 실행 완료 및 리포트
     */
    finish(): void {
      const totalDuration = Date.now() - startTime;
      const slowSteps = steps.filter((s) => s.duration > 100); // 100ms 이상 걸린 단계

      logger.info(`✓ ${context} - 전체 완료: ${totalDuration}ms`);

      if (slowSteps.length > 0) {
        logger.warn(`⚠ ${context} - 느린 단계:`);
        slowSteps.forEach((s) => {
          logger.warn(`  └─ ${s.step}: ${s.duration}ms`);
        });
      }

      // 단계별 상세 정보 (debug 레벨)
      if (logger.level === 'debug') {
        logger.debug(`${context} - 단계별 상세:`);
        steps.forEach((s, index) => {
          const percentage = ((s.duration / totalDuration) * 100).toFixed(1);
          logger.debug(
            `  ${index + 1}. ${s.step}: ${s.duration}ms (${percentage}%)`
          );
        });
      }
    },

    /**
     * 단계별 메트릭 반환
     */
    getMetrics(): { steps: StepMetrics[]; totalDuration: number } {
      return {
        steps,
        totalDuration: Date.now() - startTime,
      };
    },
  };
}

/**
 * 레이어별 실행 시간 추적
 */
export interface LayerMetrics {
  controller?: number;
  service?: number;
  repository?: number;
  database?: number;
  total: number;
}

/**
 * 레이어별 메트릭 수집기
 */
export function createLayerTracker(requestId: string) {
  const metrics: Partial<LayerMetrics> = {};
  const startTime = Date.now();

  return {
    /**
     * 레이어 실행 시간 기록
     */
    recordLayer(layer: keyof LayerMetrics, duration: number): void {
      metrics[layer] = duration;
      logger.debug(`  [${requestId}] ${layer}: ${duration}ms`);
    },

    /**
     * 전체 리포트 출력
     */
    finish(): void {
      const totalDuration = Date.now() - startTime;
      metrics.total = totalDuration;

      const layerBreakdown = Object.entries(metrics)
        .filter(([key]) => key !== 'total')
        .map(([key, value]) => `${key}: ${value}ms`)
        .join(', ');

      logger.info(
        `[${requestId}] 전체 실행: ${totalDuration}ms (${layerBreakdown})`
      );

      // 병목 레이어 감지
      const bottleneck = Object.entries(metrics)
        .filter(([key]) => key !== 'total')
        .sort(([, a], [, b]) => (b || 0) - (a || 0))[0];

      if (bottleneck && bottleneck[1] && bottleneck[1] > totalDuration * 0.5) {
        logger.warn(
          `⚠ [${requestId}] 병목 레이어: ${bottleneck[0]} (${bottleneck[1]}ms, ${((bottleneck[1] / totalDuration) * 100).toFixed(1)}%)`
        );
      }
    },

    /**
     * 메트릭 반환
     */
    getMetrics(): LayerMetrics {
      return {
        ...metrics,
        total: Date.now() - startTime,
      } as LayerMetrics;
    },
  };
}

