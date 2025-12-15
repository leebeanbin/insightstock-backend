# 📊 중간 테이블을 통한 성능 개선 제안

**목적**: 집계 쿼리 성능 개선을 위한 중간 테이블 설계

---

## 🔍 현재 상황 분석

### 1. SearchService.getPopularSearches
- **현재**: Raw Query로 실시간 집계 (최근 7일)
- **캐싱**: 10분 TTL
- **성능**: 현재 충분히 빠름 (캐시 히트 시)

### 2. UserActivityService.getUserContext
- **현재**: 여러 테이블에서 조회 후 병합
- **캐싱**: 5분 TTL
- **성능**: 현재 충분히 빠름 (캐시 히트 시)

---

## 💡 중간 테이블 제안

### 제안 1: 일일 인기 검색어 집계 테이블

**목적**: 인기 검색어 조회 성능 개선 (90% 개선 예상)

**스키마**:
```prisma
model DailyPopularSearch {
  id           String   @id @default(uuid())
  term         String   // 검색어 (종목 코드 또는 이름)
  date         DateTime @db.Date
  count        Int      // 검색 횟수
  lastSearched DateTime // 마지막 검색 시간
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([term, date])
  @@index([date])
  @@index([date, count])
  @@map("daily_popular_searches")
}
```

**장점**:
- 실시간 집계 대신 일일 집계 테이블 조회 (90% 빠름)
- 캐싱 없이도 빠른 응답

**단점**:
- 배치 작업 필요 (매일 자정 실행)
- 실시간 데이터가 아닌 전날 데이터

**구현 시점**: 검색량이 많아질 때 (일일 10,000건 이상)

---

### 제안 2: 사용자 활동 집계 테이블

**목적**: 사용자 컨텍스트 조회 성능 개선 (80% 개선 예상)

**스키마**:
```prisma
model DailyUserActivitySummary {
  id            String   @id @default(uuid())
  userId        String
  date          DateTime @db.Date
  readCount     Int      @default(0)
  likeCount     Int      @default(0)
  favoriteCount Int      @default(0)
  searchCount   Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId, date])
  @@map("daily_user_activity_summaries")
}
```

**장점**:
- 여러 테이블 조회 대신 집계 테이블 조회 (80% 빠름)
- 통계 데이터 제공 용이

**단점**:
- 배치 작업 필요
- 실시간 데이터가 아닌 전날 데이터

**구현 시점**: 사용자 수가 많아질 때 (일일 활성 사용자 1,000명 이상)

---

## 🎯 구현 전략

### Phase 1: 현재 상태 유지 (권장)
- **이유**: 캐싱으로 충분히 최적화됨
- **조건**: 데이터량이 적을 때

### Phase 2: 중간 테이블 도입 (선택)
- **조건**: 
  - 일일 검색량 10,000건 이상
  - 일일 활성 사용자 1,000명 이상
  - 캐시 히트율이 낮을 때

### Phase 3: 배치 작업 구현
- **스케줄**: 매일 자정 실행
- **작업**:
  1. 전날 데이터 집계
  2. 중간 테이블 업데이트
  3. 캐시 무효화

---

## 📝 배치 작업 예시

```typescript
// jobs/DailyAggregationJob.ts
export class DailyAggregationJob {
  async aggregatePopularSearches() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const popularSearches = await prisma.$queryRaw`
      SELECT 
        COALESCE(s.code, s.name) as term,
        COUNT(*)::int as count,
        MAX(h.viewed_at) as last_searched
      FROM histories h
      INNER JOIN stocks s ON h.stock_id = s.id
      WHERE h.type = 'search'
        AND DATE(h.viewed_at) = DATE(${yesterday})
      GROUP BY COALESCE(s.code, s.name)
      ORDER BY count DESC
    `;

    // 일일 집계 테이블에 저장
    for (const search of popularSearches) {
      await prisma.dailyPopularSearch.upsert({
        where: {
          term_date: {
            term: search.term,
            date: yesterday,
          },
        },
        update: {
          count: search.count,
          lastSearched: search.last_searched,
        },
        create: {
          term: search.term,
          date: yesterday,
          count: search.count,
          lastSearched: search.last_searched,
        },
      });
    }
  }
}
```

---

## ✅ 결론

**현재 상태**: 중간 테이블 불필요
- 캐싱으로 충분히 최적화됨
- 데이터량이 적어서 실시간 집계도 빠름

**향후 고려 사항**:
- 데이터량이 증가하면 중간 테이블 도입 검토
- 배치 작업으로 일일 집계 데이터 생성
- 실시간 데이터와 집계 데이터 병행 사용

---

**작성일**: 2025년 12월 15일  
**프로젝트**: InsightStock Backend
