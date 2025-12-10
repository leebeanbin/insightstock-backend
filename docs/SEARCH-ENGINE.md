# 검색 엔진 문서

## 개요
InsightStock Backend의 통합 검색 엔진은 종목 검색과 뉴스 검색을 지원하며, 인기 검색어 추적 및 자동완성 기능을 제공합니다.

## 기능

### 1. 통합 검색
- **엔드포인트**: `GET /api/search?q=검색어&limit=20&stockLimit=10&newsLimit=10&includeNews=true`
- **기능**: 종목과 뉴스를 동시에 검색
- **캐싱**: 검색 결과는 5분간 캐시

### 2. 종목 검색
- **엔드포인트**: `GET /api/search/stocks?q=검색어&limit=10`
- **검색 대상**: 종목 코드, 종목명, 섹터
- **우선순위**: 코드 정확 매칭 > 이름 매칭 > 섹터 매칭

### 3. 뉴스 검색
- **엔드포인트**: `GET /api/search/news?q=검색어&limit=10`
- **검색 대상**: 제목, 내용, 요약
- **정렬**: 최신순 (publishedAt desc)

### 4. 인기 검색어
- **엔드포인트**: `GET /api/search/popular?limit=10`
- **기능**: 최근 7일간의 검색 이력 기반 인기 검색어 조회
- **정렬**: 검색 횟수 > 최근 검색 시간
- **캐싱**: 10분간 캐시

### 5. 자동완성 제안
- **엔드포인트**: `GET /api/search/suggestions?q=검색어&limit=5`
- **기능**: 입력한 검색어로 시작하는 종목명/코드 제안
- **캐싱**: 5분간 캐시

## 기술적 구현

### 1. 데이터베이스 인덱싱

#### Stock 테이블
```prisma
@@index([code])
@@index([market])
@@index([sector])
@@index([name]) // 검색 최적화: 종목명 검색
@@index([code, name]) // 복합 인덱스: 코드+이름 검색 최적화
```

#### News 테이블
```prisma
@@index([publishedAt])
@@index([sentiment])
@@index([publishedAt, sentiment])
@@index([title]) // 검색 최적화: 제목 검색
@@index([source]) // 검색 최적화: 출처 검색
```

### 2. 검색 알고리즘

#### 종목 검색
- **방식**: PostgreSQL ILIKE 패턴 매칭
- **우선순위**:
  1. 코드 정확 매칭 (`code = query`)
  2. 이름 부분 매칭 (`name LIKE %query%`)
  3. 섹터 매칭 (`sector LIKE %query%`)
- **정렬**: 코드 정확 매칭 우선 > 이름 오름차순

#### 뉴스 검색
- **방식**: PostgreSQL ILIKE 패턴 매칭
- **검색 필드**:
  - 제목 (`title LIKE %query%`)
  - 내용 (`content LIKE %query%`)
  - 요약 (`summary LIKE %query%`)
- **정렬**: 최신순 (publishedAt desc)

### 3. 검색 이력 저장

- **저장 시점**: 검색 실행 시 (비동기)
- **중복 방지**: 최근 5분 내 같은 검색은 저장하지 않음
- **저장 방식**: HistoryService를 통해 `type: 'search'`로 저장
- **에러 처리**: 검색 이력 저장 실패는 치명적이지 않으므로 에러를 던지지 않음

### 4. 인기 검색어 계산

- **기간**: 최근 7일간의 검색 이력
- **집계**: 검색어별 검색 횟수 및 최근 검색 시간
- **정렬**: 검색 횟수 내림차순 > 최근 검색 시간 내림차순
- **캐싱**: 10분간 캐시

### 5. 캐싱 전략

- **검색 결과**: 5분 (TTL: 300초)
- **인기 검색어**: 10분 (TTL: 600초)
- **자동완성 제안**: 5분 (TTL: 300초)
- **캐시 키 형식**: `search:{query}:{stockLimit}:{newsLimit}`

## 성능 최적화

### 1. 인덱스 활용
- 종목명, 제목에 인덱스 추가로 검색 속도 향상
- 복합 인덱스로 코드+이름 검색 최적화

### 2. 캐싱
- Redis를 통한 검색 결과 캐싱
- 자주 검색되는 검색어의 결과를 캐시하여 응답 시간 단축

### 3. 비동기 처리
- 검색 이력 저장을 비동기로 처리하여 검색 응답 시간에 영향 없음

## 향후 개선 사항

### 1. Full-text Search (PostgreSQL)
- 현재는 ILIKE 패턴 매칭 사용
- 향후 PostgreSQL의 `tsvector`, `tsquery`를 활용한 Full-text search 구현 가능
- 한국어 형태소 분석을 위한 확장 기능 추가 고려

### 2. 검색 랭킹
- 검색 결과에 관련도 점수 추가
- 정확 매칭 > 부분 매칭 순으로 점수 부여

### 3. 검색 필터
- 종목 검색 시 시장(KOSPI/KOSDAQ) 필터
- 뉴스 검색 시 감정(sentiment) 필터

### 4. 검색 분석
- 검색어별 검색 횟수 통계
- 검색어별 클릭률 추적

## API 사용 예시

### 통합 검색
```bash
GET /api/search?q=삼성전자&limit=20&stockLimit=10&newsLimit=10
```

### 종목 검색
```bash
GET /api/search/stocks?q=삼성&limit=10
```

### 뉴스 검색
```bash
GET /api/search/news?q=반도체&limit=10
```

### 인기 검색어
```bash
GET /api/search/popular?limit=10
```

### 자동완성 제안
```bash
GET /api/search/suggestions?q=삼성&limit=5
```

