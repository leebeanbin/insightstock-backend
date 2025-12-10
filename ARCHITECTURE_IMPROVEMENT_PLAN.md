# 백엔드 아키텍처 개선 계획
## 중앙 관리형 파이프라인 & 브랜치 개념 도입

---

## 🎯 목표

1. **작업 파이프라인 중앙 관리**: 모든 백그라운드 작업을 하나의 시스템으로 통합
2. **브랜치 개념 도입**: 작업을 논리적으로 그룹화하고 관리
3. **스택 기능 최대 활용**: Prisma, Fastify, BullMQ의 고급 기능 활용
4. **어노테이션 기반 Cron Job**: 타입 세이프하고 선언적인 스케줄링

---

## 📦 현재 스택 분석

### 활용 가능한 기능들

#### 1. Prisma
- ✅ **Client Extensions**: 모델별 커스텀 메서드 추가 가능
- ✅ **Middleware**: 쿼리 전후 자동 처리 (캐싱, 로깅 등)
- ✅ **Transaction API**: 복잡한 트랜잭션 처리
- ✅ **Raw Queries**: 성능 최적화된 쿼리

#### 2. Fastify
- ✅ **Plugin System**: 모듈화된 기능 확장
- ✅ **Decorators**: 라우트별 메타데이터 추가
- ✅ **Hooks**: 라이프사이클 훅 활용
- ✅ **Schema Validation**: Zod 통합 가능

#### 3. BullMQ
- ✅ **Job Queues**: 백그라운드 작업 관리
- ✅ **Scheduled Jobs**: Cron-like 스케줄링
- ✅ **Job Priorities**: 우선순위 기반 처리
- ✅ **Job Dependencies**: 작업 간 의존성 관리

#### 4. Redis
- ✅ **Pub/Sub**: 서버 간 통신
- ✅ **Streams**: 이벤트 로깅
- ✅ **Sorted Sets**: 우선순위 큐

---

## 🏗️ 개선 아키텍처 설계

### 1. 작업 파이프라인 관리 시스템

```
┌─────────────────────────────────────────────────────────┐
│           Pipeline Manager (중앙 관리)                   │
├─────────────────────────────────────────────────────────┤
│  - 작업 등록 및 스케줄링                                  │
│  - 브랜치별 작업 그룹화                                   │
│  - 작업 상태 추적 및 모니터링                             │
│  - 의존성 관리                                           │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Data Branch │  │  Cache Branch│  │  Image Branch│
│  - 주가 수집  │  │  - 캐시 갱신  │  │  - 이미지 처리│
│  - 뉴스 크롤링│  │  - 무효화     │  │  - 정리 작업 │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 2. Prisma Client Extensions 활용

**자동 캐싱이 포함된 Prisma Client 확장**

```typescript
// src/config/prisma-extensions.ts
import { Prisma } from '@prisma/client';
import { cacheService } from '../services/CacheService';

export const prismaExtensions = Prisma.defineExtension({
  name: 'caching',
  model: {
    $allModels: {
      async findFirstWithCache<T, A>(
        this: T,
        args: A,
        cacheKey: string,
        ttl: number = 60
      ) {
        // 캐시 확인
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
        
        // DB 조회
        const result = await (this as any).findFirst(args);
        
        // 캐시 저장
        if (result) {
          await cacheService.set(cacheKey, result, ttl);
        }
        
        return result;
      },
      
      async findManyWithCache<T, A>(
        this: T,
        args: A,
        cacheKey: string,
        ttl: number = 60
      ) {
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
        
        const result = await (this as any).findMany(args);
        await cacheService.set(cacheKey, result, ttl);
        
        return result;
      },
    },
  },
});
```

### 3. Prisma Middleware 활용

**자동 캐시 무효화**

```typescript
// src/config/prisma-middleware.ts
import { cacheService } from '../services/CacheService';

prisma.$use(async (params, next) => {
  const result = await next(params);
  
  // 업데이트/삭제 시 캐시 무효화
  if (params.action === 'update' || params.action === 'delete' || params.action === 'create') {
    const model = params.model;
    if (model) {
      // 관련 캐시 패턴 삭제
      await cacheService.deletePattern(`${model}:*`);
      
      // 특정 ID가 있으면 해당 캐시도 삭제
      if (params.args?.where?.id) {
        await cacheService.delete(`${model}:${params.args.where.id}`);
      }
    }
  }
  
  return result;
});
```

### 4. Fastify Plugin 시스템 활용

**캐싱 플러그인**

```typescript
// src/plugins/cache-plugin.ts
import { FastifyPluginAsync } from 'fastify';
import { cacheService } from '../services/CacheService';

const cachePlugin: FastifyPluginAsync = async (fastify) => {
  // 라우트별 캐싱 데코레이터
  fastify.decorate('cache', (ttl: number) => {
    return async (request: any, reply: any) => {
      const cacheKey = `route:${request.method}:${request.url}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return reply.send(cached);
      }
      
      // 원본 핸들러 실행 후 결과 캐싱
      const originalSend = reply.send.bind(reply);
      reply.send = function(data: any) {
        cacheService.set(cacheKey, data, ttl);
        return originalSend(data);
      };
    };
  });
};

export default cachePlugin;
```

### 5. 어노테이션 기반 Cron Job 시스템

**데코레이터 기반 스케줄링**

```typescript
// src/decorators/scheduled.ts
export interface ScheduledOptions {
  cron: string;
  name?: string;
  timezone?: string;
  enabled?: boolean;
}

export function Scheduled(options: ScheduledOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // 메타데이터 저장
    if (!target.constructor._scheduledJobs) {
      target.constructor._scheduledJobs = [];
    }
    
    target.constructor._scheduledJobs.push({
      method: propertyKey,
      cron: options.cron,
      name: options.name || propertyKey,
      timezone: options.timezone || 'Asia/Seoul',
      enabled: options.enabled !== false,
    });
    
    return descriptor;
  };
}
```

**사용 예시:**

```typescript
// src/jobs/news-crawler.job.ts
export class NewsCrawlerJob {
  @Scheduled({
    cron: '*/5 * * * *', // 5분마다
    name: 'news-crawler',
    enabled: true,
  })
  async crawlNews() {
    // 뉴스 크롤링 로직
  }
  
  @Scheduled({
    cron: '0 2 * * 0', // 매주 일요일 새벽 2시
    name: 'news-cleanup',
  })
  async cleanupOldNews() {
    // 오래된 뉴스 정리
  }
}
```

### 6. 작업 파이프라인 관리자

**브랜치 개념 도입**

```typescript
// src/pipelines/PipelineManager.ts
export enum PipelineBranch {
  DATA = 'data',      // 데이터 수집/처리
  CACHE = 'cache',    // 캐시 관리
  IMAGE = 'image',    // 이미지 처리
  AI = 'ai',          // AI 처리
  CLEANUP = 'cleanup', // 정리 작업
}

export interface PipelineJob {
  id: string;
  branch: PipelineBranch;
  name: string;
  handler: () => Promise<void>;
  schedule?: string; // Cron 표현식
  dependencies?: string[]; // 의존성 작업 ID
  priority?: number;
  enabled: boolean;
}

export class PipelineManager {
  private jobs: Map<string, PipelineJob> = new Map();
  private branches: Map<PipelineBranch, Set<string>> = new Map();
  
  register(job: PipelineJob) {
    this.jobs.set(job.id, job);
    
    if (!this.branches.has(job.branch)) {
      this.branches.set(job.branch, new Set());
    }
    this.branches.get(job.branch)!.add(job.id);
  }
  
  async executeBranch(branch: PipelineBranch) {
    const jobIds = this.branches.get(branch) || new Set();
    const jobs = Array.from(jobIds)
      .map(id => this.jobs.get(id)!)
      .filter(job => job.enabled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // 의존성 순서대로 실행
    await this.executeWithDependencies(jobs);
  }
  
  private async executeWithDependencies(jobs: PipelineJob[]) {
    const executed = new Set<string>();
    
    const executeJob = async (job: PipelineJob) => {
      if (executed.has(job.id)) return;
      
      // 의존성 먼저 실행
      if (job.dependencies) {
        for (const depId of job.dependencies) {
          const depJob = this.jobs.get(depId);
          if (depJob && !executed.has(depId)) {
            await executeJob(depJob);
          }
        }
      }
      
      // 본 작업 실행
      await job.handler();
      executed.add(job.id);
    };
    
    for (const job of jobs) {
      await executeJob(job);
    }
  }
}
```

---

## 🚀 구현 계획

### Phase 1: 기반 구조 구축

1. **Prisma Extensions 구현**
   - `findFirstWithCache`, `findManyWithCache` 메서드 추가
   - 자동 캐시 키 생성 로직

2. **Prisma Middleware 구현**
   - 자동 캐시 무효화
   - 쿼리 로깅 및 성능 추적

3. **Fastify Cache Plugin 구현**
   - 라우트 레벨 캐싱
   - TTL 설정 지원

### Phase 2: 작업 파이프라인 시스템

4. **PipelineManager 구현**
   - 브랜치 개념 도입
   - 작업 등록 및 실행 시스템

5. **Scheduled 데코레이터 구현**
   - 어노테이션 기반 Cron Job
   - BullMQ와 통합

6. **작업 브랜치 정의**
   - DATA: 주가 수집, 뉴스 크롤링
   - CACHE: 캐시 갱신, 무효화
   - IMAGE: 이미지 처리, 정리
   - AI: AI 분석 작업
   - CLEANUP: 정리 작업

### Phase 3: 통합 및 최적화

7. **기존 서비스 통합**
   - StockService, NewsService 등에 Prisma Extensions 적용
   - 자동 캐싱 활성화

8. **모니터링 및 대시보드**
   - 파이프라인 상태 모니터링
   - 작업 실행 통계

---

## 📝 구체적 개선 사항

### 1. Prisma Client Extensions로 자동 캐싱

**Before:**
```typescript
// 매번 수동으로 캐싱 코드 작성
async getStockByCode(code: string) {
  const cacheKey = `stock:${code}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;
  
  const stock = await prisma.stock.findUnique({ where: { code } });
  await cacheService.set(cacheKey, stock, 60);
  return stock;
}
```

**After:**
```typescript
// Prisma Extension으로 자동화
async getStockByCode(code: string) {
  return await prisma.stock.findFirstWithCache(
    { where: { code } },
    `stock:${code}`,
    60
  );
}
```

### 2. Prisma Middleware로 자동 캐시 무효화

**Before:**
```typescript
// 매번 수동으로 캐시 삭제
async updatePortfolio(id: string, data: any) {
  const portfolio = await prisma.portfolio.update({ where: { id }, data });
  await cacheService.delete(`portfolio:${id}`);
  await cacheService.delete(`portfolio:list:${userId}`);
  return portfolio;
}
```

**After:**
```typescript
// Middleware가 자동으로 처리
async updatePortfolio(id: string, data: any) {
  return await prisma.portfolio.update({ where: { id }, data });
  // Middleware가 자동으로 관련 캐시 삭제
}
```

### 3. Fastify Plugin으로 라우트 레벨 캐싱

**Before:**
```typescript
// 각 컨트롤러에서 수동 캐싱
fastify.get('/stocks', async (request, reply) => {
  const cacheKey = 'stocks:list';
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;
  
  const stocks = await stockService.getStocks();
  await cacheService.set(cacheKey, stocks, 60);
  return stocks;
});
```

**After:**
```typescript
// 플러그인으로 자동 캐싱
fastify.get('/stocks', {
  preHandler: fastify.cache(60), // 1분 캐시
}, async (request, reply) => {
  return await stockService.getStocks();
});
```

### 4. 어노테이션 기반 Cron Job

**Before:**
```typescript
// 수동으로 Cron 설정
setInterval(async () => {
  await crawlNews();
}, 5 * 60 * 1000);
```

**After:**
```typescript
// 데코레이터로 선언적 스케줄링
@Scheduled({
  cron: '*/5 * * * *',
  name: 'news-crawler',
  branch: PipelineBranch.DATA,
})
async crawlNews() {
  // 뉴스 크롤링
}
```

---

## 🔧 추가 개선 사항

### 1. BullMQ를 활용한 작업 큐 확장

**현재**: Chat 작업만 큐 사용
**개선**: 모든 백그라운드 작업을 큐로 관리

```typescript
// src/queues/QueueManager.ts
export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  
  createQueue(name: string, options?: QueueOptions) {
    const queue = new Queue(name, {
      connection: redis,
      ...options,
    });
    this.queues.set(name, queue);
    return queue;
  }
  
  // 브랜치별 큐 그룹
  getBranchQueue(branch: PipelineBranch): Queue {
    return this.queues.get(`branch:${branch}`) || this.createQueue(`branch:${branch}`);
  }
}
```

### 2. Redis Streams를 활용한 이벤트 로깅

**개선**: 작업 실행 이벤트를 Streams로 기록

```typescript
// src/events/EventStream.ts
export class EventStream {
  async logJobExecution(jobId: string, status: 'start' | 'complete' | 'fail', data: any) {
    await redis.xadd('job:events', '*', 
      'jobId', jobId,
      'status', status,
      'data', JSON.stringify(data),
      'timestamp', Date.now()
    );
  }
}
```

### 3. Prisma의 Raw Query 활용

**성능 최적화**: 복잡한 집계 쿼리는 Raw Query 사용

```typescript
// src/repositories/StockRepositoryAdapter.ts
async getStockStatistics() {
  // Prisma의 Raw Query로 최적화
  return await prisma.$queryRaw`
    SELECT 
      market,
      COUNT(*) as count,
      AVG(currentPrice) as avgPrice,
      SUM(volume) as totalVolume
    FROM stocks
    GROUP BY market
  `;
}
```

### 4. Fastify의 Schema Validation 통합

**Zod 스키마로 요청/응답 검증**

```typescript
// src/schemas/stock.schema.ts
import { z } from 'zod';

export const getStockSchema = {
  params: z.object({
    code: z.string().length(6),
  }),
};

// 라우트에서 사용
fastify.get('/stocks/:code', {
  schema: {
    params: getStockSchema.params,
  },
}, async (request, reply) => {
  // 타입 세이프한 params
  const { code } = request.params; // 자동 타입 추론
});
```

---

## 📊 우선순위

### 🔴 높은 우선순위 (즉시 구현)
1. Prisma Client Extensions로 자동 캐싱
2. Prisma Middleware로 자동 캐시 무효화
3. PipelineManager 기본 구조
4. Scheduled 데코레이터 구현

### 🟡 중간 우선순위 (단기)
5. Fastify Cache Plugin
6. 작업 브랜치 정의 및 통합
7. BullMQ 확장

### 🟢 낮은 우선순위 (장기)
8. Redis Streams 이벤트 로깅
9. 모니터링 대시보드
10. 성능 최적화 (Raw Queries)

---

## 🎯 기대 효과

1. **코드 중복 제거**: 캐싱 로직이 자동화되어 중복 코드 제거
2. **유지보수성 향상**: 중앙 관리로 변경 사항 적용이 쉬움
3. **타입 안정성**: Prisma Extensions로 타입 세이프한 캐싱
4. **확장성**: 브랜치 개념으로 새로운 작업 추가가 용이
5. **모니터링**: 모든 작업이 중앙에서 관리되어 추적 가능

