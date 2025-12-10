# InsightStock Backend

AI 기반 금융 학습 플랫폼 백엔드 API - Clean Architecture + DDD

## 🚀 프로젝트 상태

### ✅ 완료된 API
- **Dashboard**: 사용자 대시보드 및 통계
- **News & Feed**: 뉴스 피드, AI 분석, 텍스트 하이라이팅
- **Note**: 노트 관리, 뉴스 스크랩, Kindle-style 하이라이팅

### 🚧 개발 진행 중
- **Portfolio**: 포트폴리오 관리 및 추적
- **Chat**: AI 챗봇 및 학습 지원
- **Stock**: 주식 데이터 및 가격 분석
- **Learning**: 학습 추천 및 진행 상황

## 📋 목차

- [아키텍처](#아키텍처)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [API 엔드포인트](#api-엔드포인트)
- [데이터 흐름](#데이터-흐름)
- [캐싱 전략](#캐싱-전략)
- [환경 설정](#환경-설정)
- [실행 방법](#실행-방법)

## 🏗️ 아키텍처

**DDD (Domain-Driven Design) + Clean Architecture**

### 계층 구조

```
Controller (HTTP 요청 처리)
    ↓
Facade (비즈니스 로직 인터페이스)
    ↓
Service (Facade 구현, Repository 의존)
    ↓
Repository (DB 접근 인터페이스)
    ↓
Adapter (Repository 구현 + 에러 처리, Prisma)
```

### DTO 패턴

- **Request DTO**: `from()` 메서드로 외부 데이터 → Entity 변환
- **Response DTO**: `to()` 메서드로 Entity → 외부 데이터 변환
- Entity 직접 노출 금지

## 🛠️ 기술 스택

- **Runtime**: Node.js 20+
- **Framework**: Fastify 5.x
- **Language**: TypeScript 5.x
- **Architecture**: DDD + Clean Architecture
- **ORM**: Prisma (PostgreSQL)
- **Cache**: Redis (ioredis) - 준비됨
- **AI**: OpenAI GPT-4o mini
- **Vector DB**: Pinecone
- **Logger**: Winston
- **Validation**: Zod

## 📁 프로젝트 구조

```
src/
├── controllers/     # HTTP 요청 처리 (Facade 의존)
│   ├── PortfolioController.ts
│   ├── StockController.ts
│   ├── MarketController.ts
│   ├── FavoriteController.ts
│   ├── HistoryController.ts
│   ├── ChatController.ts
│   ├── NewsController.ts
│   └── ProxyController.ts
├── facades/         # 비즈니스 로직 인터페이스
│   ├── IPortfolioFacade.ts
│   ├── IStockFacade.ts
│   ├── IMarketFacade.ts
│   └── ...
├── services/        # Facade 구현 (Repository 의존)
│   ├── PortfolioService.ts
│   ├── StockService.ts
│   ├── MarketService.ts
│   └── ...
├── repositories/    # DB 접근 인터페이스
│   ├── IPortfolioRepository.ts
│   ├── IStockRepository.ts
│   └── ...
├── adapters/        # Repository 구현 + 에러 처리
│   ├── PortfolioRepositoryAdapter.ts
│   ├── NaverStockApiAdapter.ts
│   ├── StockRepositoryAdapter.ts
│   └── ...
├── entities/        # Domain Model (순수 비즈니스 로직)
│   ├── Portfolio.ts
│   ├── Stock.ts
│   ├── Favorite.ts
│   └── ...
├── dto/             # Request/Response DTO
│   ├── portfolio/
│   ├── stock/
│   ├── market/
│   └── ...
├── routes/          # API routes + DI 설정
│   ├── PortfolioRoutes.ts
│   ├── StockRoutes.ts
│   ├── MarketRoutes.ts
│   └── ...
├── middlewares/     # Custom middleware
│   ├── auth.ts
│   └── error-handler.ts
├── config/          # Configuration
│   ├── prisma.ts
│   └── logger.ts
└── utils/           # Utility functions
```

## 🔌 API 엔드포인트

### Base URL
- 개발: `http://localhost:3001`
- 프로덕션: 환경 변수에 따라 설정

### 인증
대부분의 API는 JWT 토큰이 필요합니다. 헤더에 포함:
```
Authorization: Bearer <token>
```

### 1. Health Check
```
GET /health
```
서버 상태 확인

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-26T10:00:00.000Z",
  "uptime": 12345
}
```

### 2. Market (증시 정보) - 인증 불필요
```
GET /api/market
GET /v1/market
```
KOSPI, KOSDAQ, USD/KRW 환율 정보

**Response:**
```json
{
  "success": true,
  "data": {
    "kospi": {
      "price": 2650.5,
      "change": 12.3,
      "changePercent": 0.47
    },
    "kosdaq": {
      "price": 875.2,
      "change": -5.1,
      "changePercent": -0.58
    },
    "usdKrw": {
      "price": 1335.5,
      "change": 2.3,
      "changePercent": 0.17
    }
  }
}
```

### 3. Stocks (주식 정보) - 인증 불필요
```
GET /api/stocks?search=<query>              # 종목 검색
GET /api/stocks?withPrice=true&category=<category>  # 카테고리별 종목
GET /api/stocks/categories                  # 카테고리 목록
GET /api/stocks/:code?chart=true&period=30  # 종목 상세 (차트 포함)
```

**검색 예시:**
```json
{
  "success": true,
  "data": [
    {
      "id": "search-0",
      "code": "005930",
      "name": "삼성전자",
      "market": "KOSPI",
      "sector": "IT",
      "currentPrice": 71000,
      "change": 500,
      "changePercent": 0.71,
      "volume": 5000000
    }
  ]
}
```

**상세 정보 예시:**
```json
{
  "success": true,
  "data": {
    "id": "005930",
    "code": "005930",
    "name": "삼성전자",
    "market": "KOSPI",
    "currentPrice": 71000,
    "change": 500,
    "changePercent": 0.71,
    "volume": 5000000,
    "high": 71500,
    "low": 70500,
    "open": 70800,
    "marketCap": 425000000000000,
    "chartData": [
      {
        "time": "1월 1일",
        "value": 70000,
        "volume": 5000000
      }
    ]
  }
}
```

### 4. Portfolio (포트폴리오) - 인증 필요
```
GET    /api/portfolio           # 포트폴리오 목록
GET    /api/portfolio/:id       # 포트폴리오 상세
POST   /api/portfolio           # 포트폴리오 추가
PUT    /api/portfolio/:id       # 포트폴리오 수정
DELETE /api/portfolio/:id       # 포트폴리오 삭제
```

**요청 예시 (POST):**
```json
{
  "stockId": "stock-id",
  "quantity": 10,
  "averagePrice": 70000
}
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "id": "portfolio-id",
    "userId": "user-id",
    "stockId": "stock-id",
    "stock": {
      "code": "005930",
      "name": "삼성전자",
      "market": "KOSPI",
      "currentPrice": 71000,
      "change": 500,
      "changeRate": 0.71
    },
    "quantity": 10,
    "averagePrice": 70000,
    "totalCost": 700000,
    "currentValue": 710000,
    "profit": 10000,
    "profitRate": 1.43,
    "createdAt": "2025-01-26T10:00:00.000Z",
    "updatedAt": "2025-01-26T10:00:00.000Z"
  }
}
```

### 5. Favorites (즐겨찾기) - 인증 필요
```
GET    /api/favorites              # 즐겨찾기 목록
POST   /api/favorites              # 즐겨찾기 추가
DELETE /api/favorites/:id          # 즐겨찾기 삭제
GET    /api/favorites/check/:stockId  # 즐겨찾기 여부 확인
```

**요청 예시 (POST):**
```json
{
  "stockId": "stock-id"
}
```

### 6. History (조회 기록) - 인증 필요
```
GET    /api/history?limit=50    # 조회 기록 목록
POST   /api/history             # 조회 기록 추가
DELETE /api/history             # 조회 기록 전체 삭제
```

**요청 예시 (POST):**
```json
{
  "stockId": "stock-id",
  "type": "view"
}
```

### 7. Chat (AI 채팅) - 인증 필요
```
GET    /api/chat/conversations                    # 대화 목록
GET    /api/chat/conversations/:id/messages        # 메시지 목록
GET    /api/chat/stream?conversationId=&message=  # SSE 스트리밍
POST   /api/chat/stream                           # SSE 스트리밍 (POST)
DELETE /api/chat/conversations/:id                # 대화 삭제
```

**SSE 스트리밍 응답:**
```
data: {"content": "메시지 청크"}
data: {"content": "메시지 청크"}
data: {"done": true}
```

### 8. News (뉴스) - 인증 불필요
```
GET /api/news?stockCode=005930&limit=20&offset=0&sentiment=positive
GET /api/news/stock/:stockCode?limit=20
GET /api/news/:id
```

### 9. Proxy (네이버 API 프록시) - 인증 불필요
```
GET /api/proxy/stock/:code?endpoint=basic    # 네이버 주식 API 프록시
GET /api/proxy/search?q=<query>              # 네이버 검색 프록시
GET /api/proxy/chart/:code?startDateTime=&endDateTime=  # 네이버 차트 프록시
GET /v1/proxy/*                              # V1 호환 경로
```

## 🔄 데이터 흐름

### 1. 종목 조회 흐름

```
프론트엔드
  ↓ GET /api/stocks/:code
백엔드 Controller
  ↓
StockFacade (인터페이스)
  ↓
StockService (구현)
  ↓
NaverStockApiAdapter (외부 API 호출)
  ↓
네이버 주식 API (https://m.stock.naver.com/api/stock/:code/basic)
  ↓
StockDetailResponseDto 변환
  ↓
프론트엔드 응답
```

### 2. 포트폴리오 생성 흐름

```
프론트엔드
  ↓ POST /api/portfolio (JWT 토큰 포함)
백엔드 Controller
  ↓ (인증 미들웨어)
PortfolioFacade
  ↓
PortfolioService
  ↓
CreatePortfolioDto.from() → Portfolio Entity
  ↓
PortfolioRepository (Prisma)
  ↓
PostgreSQL
  ↓
PortfolioResponseDto.to() → 응답
```

### 3. AI 채팅 스트리밍 흐름

```
프론트엔드 (EventSource)
  ↓ GET /api/chat/stream
백엔드 Controller
  ↓
ChatFacade
  ↓
ChatService
  ↓
OpenAI API (스트리밍)
  ↓
SSE 청크 전송
  ↓
프론트엔드 실시간 표시
```

## 💾 캐싱 전략

### 현재 상태
- Redis 클라이언트 (ioredis) 설치됨
- 캐싱 로직은 아직 구현되지 않음

### 권장 캐싱 전략

#### 1. 종목 가격 정보
- **캐시 키**: `stock:price:{code}`
- **TTL**: 30초
- **이유**: 실시간 주가 정보는 빠르게 변하므로 짧은 TTL 필요

#### 2. 시장 데이터 (KOSPI, KOSDAQ)
- **캐시 키**: `market:data`
- **TTL**: 10초
- **이유**: 시장 지수는 자주 업데이트되지만 API 호출 비용 절감

#### 3. 종목 검색 결과
- **캐시 키**: `stock:search:{query}`
- **TTL**: 5분
- **이유**: 검색어는 자주 변경되지 않음

#### 4. 종목 상세 정보
- **캐시 키**: `stock:detail:{code}`
- **TTL**: 1분
- **이유**: 상세 정보는 자주 변경되지 않지만 실시간성 필요

#### 5. 차트 데이터
- **캐시 키**: `stock:chart:{code}:{period}`
- **TTL**: 5분
- **이유**: 과거 데이터는 자주 변경되지 않음

### 구현 예시

```typescript
// services/StockService.ts
import { Redis } from 'ioredis';

export class StockService {
  constructor(
    private readonly naverApi: NaverStockApiAdapter,
    private readonly redis: Redis
  ) {}

  async getStockPrice(code: string): Promise<StockPriceData> {
    const cacheKey = `stock:price:${code}`;
    
    // 캐시 확인
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // API 호출
    const data = await this.naverApi.getStockPrice(code);
    
    // 캐시 저장 (30초 TTL)
    await this.redis.setex(cacheKey, 30, JSON.stringify(data));
    
    return data;
  }
}
```

## ⚙️ 환경 설정

### 환경 변수 (.env)

```bash
# 서버 설정
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# 데이터베이스
DATABASE_URL=postgresql://user:password@localhost:5432/insightstock

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=sk-...

# Pinecone
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...
PINECONE_INDEX_NAME=...

# 네이버 API (프록시용)
NAVER_API_BASE_URL=https://m.stock.naver.com/api
```

## 🚀 실행 방법

### 옵션 1: 자동 설정 스크립트 (권장)

**전체 프로젝트 설정을 위한 대화형 설정 스크립트를 제공합니다:**

```bash
# 루트 디렉토리에서 전체 프로젝트 설정
cd /Users/leejungbin/Downloads
bash setup-insightstock.sh
```

또는 백엔드만 설정:

```bash
# 백엔드 디렉토리에서
bash setup.sh
```

**설정 스크립트가 자동으로 체크하는 항목:**
1. ✅ Node.js 설치 확인
2. ✅ pnpm 설치 확인
3. ✅ 의존성 설치 (node_modules)
4. ✅ 환경 변수 파일 (.env)
5. ✅ PostgreSQL 연결 및 데이터베이스 생성
6. ✅ Prisma Client 생성
7. ✅ 데이터베이스 스키마 동기화
8. ✅ 샘플 데이터 주입 (선택)

각 단계마다 이미 완료되었는지 확인하고, 필요한 경우에만 실행 여부를 물어봅니다.

---

### 옵션 2: 수동 설정

#### 1. 의존성 설치

```bash
pnpm install
```

#### 2. 환경 변수 설정

```bash
# .env 파일이 이미 있다면 확인, 없다면 생성
# 필수 설정:
PORT=3001
DATABASE_URL="postgresql://leejungbin@localhost:5432/insightstock?schema=public"
CORS_ORIGIN=http://localhost:3000

# 채팅 기능 사용 시 필수:
OPENAI_API_KEY=sk-your-openai-api-key-here

# 선택사항 (RAG 기능):
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=insightstock
```

#### 3. 데이터베이스 설정

```bash
# 데이터베이스 생성 (없는 경우)
createdb insightstock

# Prisma Client 생성
pnpm db:generate

# 스키마를 데이터베이스에 푸시
pnpm db:push --accept-data-loss

# 테스트용 사용자 생성 (자동으로 생성됨)
```

#### 4. 개발 서버 실행

```bash
pnpm dev
```

서버가 `http://localhost:3001`에서 실행됩니다.

### 5. API 키 설정 (채팅 기능 사용 시)

`.env` 파일에 OpenAI API 키를 추가하세요:

```bash
OPENAI_API_KEY=sk-your-actual-api-key
```

**OpenAI API 키 발급:**
1. https://platform.openai.com/api-keys 접속
2. 계정 생성/로그인
3. "Create new secret key" 클릭
4. 생성된 키를 `.env` 파일에 추가

자세한 설정 가이드는 [SETUP.md](./SETUP.md)를 참조하세요.

### 5. 프로덕션 빌드

```bash
# TypeScript 컴파일
pnpm build

# 프로덕션 서버 실행
pnpm start
```

## 📊 데이터베이스 스키마

Prisma 스키마는 `prisma/schema.prisma`에 정의되어 있습니다.

주요 엔티티:
- `User` - 사용자
- `Portfolio` - 포트폴리오
- `Favorite` - 즐겨찾기
- `History` - 조회 기록
- `Conversation` - 채팅 대화
- `Message` - 채팅 메시지
- `News` - 뉴스

### ✅ 데이터베이스 셋업 완료

다음 명령어로 데이터베이스가 이미 설정되어 있습니다:
- ✅ 데이터베이스 생성 완료
- ✅ 모든 테이블 생성 완료
- ✅ 테스트용 사용자 생성 완료 (`dev-user-001`)

**데이터베이스 확인:**
```bash
pnpm db:studio  # Prisma Studio로 데이터베이스 내용 확인
```

## 🔒 인증 및 보안

### JWT 토큰
- 토큰은 `Authorization: Bearer <token>` 헤더로 전달
- 토큰 만료 시 401 응답
- 미들웨어: `src/middlewares/auth.ts`

### CORS
- 개발 환경: 모든 origin 허용
- 프로덕션: `CORS_ORIGIN` 환경 변수로 제한

## 📝 로깅

Winston을 사용한 구조화된 로깅:
- 레벨: error, warn, info, debug
- 파일: `logs/` 디렉토리
- 콘솔: 개발 환경에서 활성화

## 🧪 테스트

```bash
# 테스트 실행 (구현 예정)
pnpm test
```

## 📚 추가 문서

- **[Quick Start](./QUICK_START.md)** - 빠른 시작 가이드
- **[Setup Guide](./SETUP.md)** - 환경 설정 가이드
- **[Architecture](./docs/ARCHITECTURE.md)** - 아키텍처 상세 설명

## 🎯 테스트 가능한 기능

### ✅ 즉시 사용 가능 (API 키 불필요)
- Market API (증시 정보)
- Stock API (종목 정보, 검색)
- Proxy API (네이버 API 프록시)
- Portfolio API (포트폴리오 관리)
- Favorites API (즐겨찾기)
- History API (조회 기록)

### 🔑 API 키 필요
- **Chat API** (AI 채팅) - OpenAI API 키 필요
  - `.env` 파일에 `OPENAI_API_KEY=sk-your-key` 추가
  - 발급: https://platform.openai.com/api-keys

### 📝 검색 기능
- 네이버 API를 통한 실시간 검색
- API 실패 시 로컬 검색으로 자동 폴백
- 인기 종목 목록 제공

### 💬 채팅 기능
- OpenAI GPT-4o mini 사용
- SSE 스트리밍 지원
- 대화 기록 저장
- API 키 설정 후 즉시 사용 가능

## 📄 라이선스

MIT
