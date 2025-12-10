# 백엔드 아키텍처 및 API 흐름도

## 📐 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Frontend)                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP/WebSocket
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    Fastify Server                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware Layer                                     │   │
│  │  - CORS                                              │   │
│  │  - Authentication (JWT)                             │   │
│  │  - Rate Limiting (Redis)                            │   │
│  │  - Request Logging                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                        │                                      │
│  ┌─────────────────────▼──────────────────────────────────┐ │
│  │  Routes Layer                                          │ │
│  │  /api/portfolio, /api/stocks, /api/chat, etc.        │ │
│  └─────────────────────┬──────────────────────────────────┘ │
│                        │                                      │
│  ┌─────────────────────▼──────────────────────────────────┐ │
│  │  Controllers Layer                                     │ │
│  │  - Request Validation                                 │ │
│  │  - Response Formatting                                │ │
│  └─────────────────────┬──────────────────────────────────┘ │
│                        │                                      │
│  ┌─────────────────────▼──────────────────────────────────┐ │
│  │  Services Layer (Facades)                             │ │
│  │  - Business Logic                                     │ │
│  │  - Data Transformation                                │ │
│  │  - Cache Management (Redis)                           │ │
│  └─────────────────────┬──────────────────────────────────┘ │
│                        │                                      │
│  ┌─────────────────────▼──────────────────────────────────┐ │
│  │  Repositories Layer (Adapters)                        │ │
│  │  - Database Access                                    │ │
│  │  - Query Optimization                                 │ │
│  └─────────────────────┬──────────────────────────────────┘ │
└────────────────────────┼──────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼────┐  ┌───────▼──────┐  ┌────▼────────┐
│   Prisma    │  │    Redis     │  │   OpenAI    │
│  (PostgreSQL)│  │  (Cache/Queue)│  │    API     │
└─────────────┘  └──────────────┘  └─────────────┘
```

---

## 🔄 API 요청 흐름도

### 일반적인 API 요청 흐름

```
1. Client Request
   │
   ├─> Fastify Server
   │   │
   │   ├─> CORS Middleware
   │   │
   │   ├─> Authentication Middleware
   │   │   └─> Extract userId from JWT
   │   │
   │   ├─> Rate Limiting Middleware
   │   │   └─> Check Redis for rate limits
   │   │
   │   └─> Route Handler
   │       │
   │       └─> Controller
   │           │
   │           ├─> Request Validation (DTO)
   │           │
   │           └─> Service (Facade)
   │               │
   │               ├─> Check Cache (Redis)
   │               │   └─> Cache Hit? Return cached data
   │               │
   │               ├─> Repository (Adapter)
   │               │   └─> Prisma Query
   │               │       └─> PostgreSQL
   │               │
   │               └─> Transform to DTO
   │                   │
   │                   └─> Store in Cache (Redis)
   │
   └─> Response
       └─> { success: true, data: ... }
```

### 채팅 API 흐름 (WebSocket)

```
1. WebSocket Connection
   │
   ├─> WebSocket Authentication
   │   └─> Extract userId
   │
   ├─> WebSocketService
   │   │
   │   ├─> Connection Management
   │   │   └─> Store in Redis
   │   │
   │   └─> Message Handler
   │       │
   │       └─> ChatService
   │           │
   │           ├─> Get User Context (Redis Cache)
   │           │
   │           ├─> OpenAI API (Streaming)
   │           │
   │           ├─> Save Message (Prisma)
   │           │
   │           └─> Invalidate Cache
   │
   └─> Stream Response to Client
```

---

## 📊 API 엔드포인트 구조

### 인증이 필요한 API

| 엔드포인트 | Method | Controller | Service | Repository |
|-----------|--------|------------|---------|------------|
| `/api/portfolio` | GET | PortfolioController | PortfolioService | PortfolioRepository |
| `/api/portfolio/:id` | GET | PortfolioController | PortfolioService | PortfolioRepository |
| `/api/portfolio` | POST | PortfolioController | PortfolioService | PortfolioRepository |
| `/api/portfolio/:id` | PUT | PortfolioController | PortfolioService | PortfolioRepository |
| `/api/portfolio/:id` | DELETE | PortfolioController | PortfolioService | PortfolioRepository |
| `/api/favorites` | GET | FavoriteController | FavoriteService | FavoriteRepository |
| `/api/favorites` | POST | FavoriteController | FavoriteService | FavoriteRepository |
| `/api/favorites/:id` | DELETE | FavoriteController | FavoriteService | FavoriteRepository |
| `/api/favorites/check/:stockId` | GET | FavoriteController | FavoriteService | FavoriteRepository |
| `/api/history` | GET | HistoryController | HistoryService | HistoryRepository |
| `/api/history` | POST | HistoryController | HistoryService | HistoryRepository |
| `/api/history` | DELETE | HistoryController | HistoryService | HistoryRepository |
| `/api/chat/conversations` | GET | ChatController | ChatService | ConversationRepository |
| `/api/chat/conversations/:id/messages` | GET | ChatController | ChatService | MessageRepository |
| `/api/chat/stream` | GET/POST | ChatController | ChatService | MessageRepository |
| `/api/chat/ws` | WebSocket | WebSocketService | ChatService | MessageRepository |
| `/api/user-activity/*` | * | UserActivityController | UserActivityService | Prisma Direct |
| `/api/learning/today` | GET | LearningController | LearningRecommendationService | Prisma Direct |
| `/api/notes` | * | NoteController | NoteService | Prisma Direct |

### 공개 API (인증 불필요)

| 엔드포인트 | Method | Controller | Service | Repository |
|-----------|--------|------------|---------|------------|
| `/api/stocks` | GET | StockController | StockService | StockRepository |
| `/api/stocks/:code` | GET | StockController | StockService | StockRepository |
| `/api/market` | GET | MarketController | MarketService | Prisma Direct |
| `/api/news` | GET | NewsController | NewsService | NewsRepository |
| `/api/news/:id` | GET | NewsController | NewsService | NewsRepository |

---

## 🔄 데이터 흐름 패턴

### 1. CRUD 패턴 (Portfolio 예시)

```
Request: POST /api/portfolio
Body: { stockId, quantity, averagePrice }

1. Controller
   ├─> Extract userId from request
   ├─> Validate DTO (CreatePortfolioDto)
   └─> Call Service

2. Service (PortfolioService)
   ├─> Check duplicate (findByUserAndStock)
   ├─> Get Stock data
   ├─> Create Portfolio entity
   └─> Call Repository

3. Repository (PortfolioRepositoryAdapter)
   ├─> Prisma.portfolio.create()
   └─> Return Portfolio entity

4. Service
   ├─> Transform to DTO (PortfolioResponseDto)
   └─> Return DTO

5. Controller
   ├─> Format response
   └─> Send { success: true, data: PortfolioResponseDto }
```

### 2. 조회 패턴 (캐싱 포함)

```
Request: GET /api/chat/conversations

1. Controller
   └─> Call Service

2. Service (ChatService)
   ├─> Check Redis Cache
   │   └─> Cache Key: "conversations:{userId}"
   │
   ├─> Cache Hit?
   │   └─> Return cached data
   │
   └─> Cache Miss?
       ├─> Call Repository
       ├─> Transform to DTO
       ├─> Store in Cache (TTL: 5분)
       └─> Return DTO

3. Controller
   └─> Send { success: true, data: ConversationResponseDto[] }
```

### 3. 스트리밍 패턴 (채팅)

```
Request: POST /api/chat/stream
Body: { conversationId?, message }

1. Controller
   ├─> Set SSE Headers
   └─> Call Service.streamChat()

2. Service (ChatService)
   ├─> Get or Create Conversation
   ├─> Save User Message
   ├─> Get User Context (if enabled)
   ├─> Build System Message
   └─> OpenAI Streaming
       │
       └─> For each chunk:
           ├─> Yield chunk to Controller
           └─> Controller writes to SSE stream

3. After streaming:
   ├─> Save Assistant Message
   ├─> Update Conversation
   └─> Invalidate Cache
```

---

## 📦 데이터 전달 구조

### Request → Controller → Service → Repository

```
Request Body
    │
    ├─> DTO.from(request.body)
    │   └─> Zod Validation
    │
    └─> Controller
        │
        └─> Service.method(userId, dto)
            │
            └─> Repository.method(userId, ...)
                │
                └─> Prisma Query
```

### Repository → Service → Controller → Response

```
Prisma Result (Entity)
    │
    ├─> Entity Object
    │
    └─> Service
        │
        ├─> Transform to DTO
        │   └─> DTO.to(entity, ...)
        │
        └─> Controller
            │
            └─> Response Format
                └─> { success: true, data: DTO }
```

---

## 🔐 인증 및 보안 흐름

```
1. Request with Authorization Header
   │
   ├─> Authentication Middleware
   │   │
   │   ├─> Extract Token
   │   │   └─> Bearer <token>
   │   │
   │   ├─> Verify JWT
   │   │   └─> Extract userId
   │   │
   │   └─> Set request.userId
   │
   └─> Route Handler
       │
       └─> Controller
           └─> Use request.userId!
```

---

## 🚀 성능 최적화 흐름

### 캐싱 전략

```
1. Read Operation
   │
   ├─> Check Redis Cache
   │   │
   │   ├─> Cache Hit
   │   │   └─> Return cached data (50ms)
   │   │
   │   └─> Cache Miss
   │       ├─> Query Database (200ms)
   │       ├─> Transform to DTO
   │       ├─> Store in Cache
   │       └─> Return data
   │
   └─> Write Operation
       ├─> Update Database
       └─> Invalidate Cache
```

### Rate Limiting

```
1. Request
   │
   ├─> Rate Limiting Middleware
   │   │
   │   ├─> Check Redis
   │   │   └─> Key: "rate-limit:{userId}"
   │   │
   │   ├─> Within Limit?
   │   │   └─> Increment counter
   │   │       └─> Continue
   │   │
   │   └─> Exceeded Limit?
   │       └─> Return 429
   │
   └─> Process Request
```

---

## 🔄 에러 처리 흐름

```
1. Error Occurs
   │
   ├─> Service/Repository Level
   │   └─> Throw AppError
   │       ├─> NotFoundError (404)
   │       ├─> ValidationError (400)
   │       ├─> ConflictError (409)
   │       └─> DatabaseError (500)
   │
   ├─> Controller Level
   │   └─> Let error propagate
   │
   └─> Global Error Handler
       │
       ├─> AppError?
       │   └─> Format: { success: false, message: ... }
       │
       ├─> ZodError?
       │   └─> Format: { success: false, errors: ... }
       │
       └─> Unknown Error?
           └─> Format: { success: false, message: ... }
```

---

## 📝 주요 설계 패턴

### 1. Facade Pattern
- Service가 Facade 인터페이스를 구현
- Controller는 Facade만 의존

### 2. Repository Pattern
- Repository 인터페이스 정의
- Adapter가 Prisma를 래핑

### 3. DTO Pattern
- Request: DTO.from()으로 검증
- Response: DTO.to()로 변환

### 4. Dependency Injection
- Routes에서 의존성 주입
- 테스트 가능한 구조

---

## 🎯 일관성 체크리스트

### ✅ 일관된 부분

1. **응답 형식**
   - 성공: `{ success: true, data: ... }`
   - 실패: `{ success: false, message: ... }`

2. **에러 처리**
   - AppError 계층 구조
   - Global Error Handler

3. **인증**
   - 모든 사용자 데이터 API에 인증 필수
   - `request.userId` 사용

4. **DTO 패턴**
   - 모든 Request는 DTO로 검증
   - 모든 Response는 DTO로 변환

### ⚠️ 개선 필요 부분

1. **응답 메시지 일관성**
   - 일부는 `message` 필드 사용
   - 일부는 `message` 필드 없음

2. **상태 코드**
   - 일부는 201 (Created) 사용
   - 일부는 200 (OK) 사용

3. **페이징**
   - 일부 API는 페이징 지원
   - 일부는 미지원

4. **메타데이터**
   - 일부는 `meta` 필드 사용
   - 일부는 미사용

