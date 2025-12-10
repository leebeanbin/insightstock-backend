# InsightStock Backend 아키텍처 문서

## 목차
1. [아키텍처 개요](#아키텍처-개요)
2. [계층 구조 (Layered Architecture)](#계층-구조)
3. [디자인 패턴](#디자인-패턴)
4. [트랜잭션 관리](#트랜잭션-관리)
5. [데이터베이스 설계](#데이터베이스-설계)

---

## 아키텍처 개요

InsightStock Backend는 **계층형 아키텍처(Layered Architecture)**와 **의존성 주입(Dependency Injection)** 패턴을 기반으로 설계되었습니다.

### 기술 스택
- **Runtime**: Node.js + TypeScript
- **Framework**: Fastify
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Architecture Pattern**: Layered Architecture + Repository Pattern

---

## 계층 구조

```
┌─────────────────────────────────────┐
│         Routes Layer                 │  HTTP 요청 라우팅
├─────────────────────────────────────┤
│         Controllers Layer            │  요청/응답 처리, HTTP 상태 코드 관리
├─────────────────────────────────────┤
│         Facades Layer (Interface)    │  비즈니스 로직 인터페이스 정의
├─────────────────────────────────────┤
│         Services Layer               │  비즈니스 로직 구현, 트랜잭션 관리
├─────────────────────────────────────┤
│         Repositories Layer (Interface)│  데이터 접근 인터페이스 정의
├─────────────────────────────────────┤
│         Adapters Layer               │  Prisma를 사용한 Repository 구현
├─────────────────────────────────────┤
│         Entities Layer               │  도메인 엔티티
├─────────────────────────────────────┤
│         DTOs Layer                   │  데이터 전송 객체
└─────────────────────────────────────┘
```

### 1. Routes Layer (`src/routes/`)
- **책임**: HTTP 요청 라우팅, 미들웨어 적용
- **예시**: `FavoriteRoutes.ts`, `HistoryRoutes.ts`
- **특징**:
  - Fastify 플러그인으로 구현
  - 인증 미들웨어 적용
  - 의존성 주입으로 Controller 생성

### 2. Controllers Layer (`src/controllers/`)
- **책임**: HTTP 요청/응답 처리, 상태 코드 관리
- **예시**: `FavoriteController.ts`
- **특징**:
  - Facade 인터페이스를 의존성으로 받음
  - 에러 핸들링 및 로깅
  - DTO 변환

### 3. Facades Layer (`src/facades/`)
- **책임**: 비즈니스 로직 인터페이스 정의
- **예시**: `IFavoriteFacade.ts`, `IHistoryFacade.ts`
- **특징**:
  - Service 레이어의 공개 API 정의
  - 인터페이스 분리 원칙(ISP) 준수

### 4. Services Layer (`src/services/`)
- **책임**: 비즈니스 로직 구현, 트랜잭션 관리
- **예시**: `FavoriteService.ts`, `HistoryService.ts`, `PortfolioService.ts`
- **특징**:
  - Repository 인터페이스를 의존성으로 받음
  - 트랜잭션 관리 (`executeTransaction` 사용)
  - 비즈니스 규칙 검증

### 5. Repositories Layer (`src/repositories/`)
- **책임**: 데이터 접근 인터페이스 정의
- **예시**: `IFavoriteRepository.ts`, `IStockRepository.ts`
- **특징**:
  - 데이터 접근 로직 추상화
  - 테스트 용이성 향상 (Mock Repository 주입 가능)

### 6. Adapters Layer (`src/adapters/`)
- **책임**: Prisma를 사용한 Repository 구현
- **예시**: `FavoriteRepositoryAdapter.ts`, `StockRepositoryAdapter.ts`
- **특징**:
  - Prisma Client를 사용한 실제 데이터베이스 접근
  - 트랜잭션 클라이언트 지원 (`withTransaction` 메서드)

### 7. Entities Layer (`src/entities/`)
- **책임**: 도메인 엔티티 정의
- **예시**: `Favorite.ts`, `Stock.ts`, `Portfolio.ts`
- **특징**:
  - 비즈니스 로직 포함 (예: `Portfolio.recalculate()`)
  - 불변성 보장

### 8. DTOs Layer (`src/dto/`)
- **책임**: 데이터 전송 객체
- **예시**: `FavoriteResponseDto.ts`, `CreateFavoriteDto.ts`
- **특징**:
  - API 응답 형식 정의
  - 데이터 검증 및 변환

---

## 디자인 패턴

### 1. Repository Pattern
- **목적**: 데이터 접근 로직을 추상화하여 비즈니스 로직과 분리
- **구현**:
  - Interface: `src/repositories/I*.ts`
  - Implementation: `src/adapters/*RepositoryAdapter.ts`
- **장점**:
  - 데이터 소스 변경 용이 (예: PostgreSQL → MongoDB)
  - 테스트 용이성 (Mock Repository 주입)
  - 비즈니스 로직과 데이터 접근 로직 분리

### 2. Adapter Pattern
- **목적**: Prisma를 Repository 인터페이스에 맞춤
- **구현**: `*RepositoryAdapter` 클래스
- **특징**:
  - 트랜잭션 클라이언트 지원
  - 에러 처리 및 로깅

### 3. Facade Pattern
- **목적**: 복잡한 서브시스템을 단순한 인터페이스로 제공
- **구현**: `IFavoriteFacade`, `IHistoryFacade` 등
- **장점**:
  - 클라이언트 코드 단순화
  - 서브시스템 변경 시 영향 최소화

### 4. Dependency Injection
- **목적**: 의존성을 외부에서 주입하여 결합도 감소
- **구현**: Constructor Injection
- **예시**:
  ```typescript
  // Routes에서 의존성 주입
  const favoriteRepository = new FavoriteRepositoryAdapter();
  const stockRepository = new StockRepositoryAdapter();
  const favoriteFacade = new FavoriteService(favoriteRepository, stockRepository);
  const favoriteController = new FavoriteController(favoriteFacade);
  ```

---

## 트랜잭션 관리

### 트랜잭션이 필요한 경우

1. **여러 테이블에 동시에 데이터를 쓰는 경우**
   - 예: Stock 조회 + Favorite 생성
   - 이유: 데이터 일관성 보장 (ACID 원칙)

2. **중복 체크와 생성이 원자적으로 처리되어야 하는 경우**
   - 예: Favorite 중복 체크 + 생성
   - 이유: Race Condition 방지

3. **외래 키 제약 조건을 만족해야 하는 경우**
   - 예: Portfolio 생성 시 Stock 존재 확인
   - 이유: 참조 무결성 보장

4. **동시성 문제를 방지해야 하는 경우**
   - 예: Portfolio 업데이트 시 Stock 가격 변경
   - 이유: 일관된 데이터 상태 유지

### 트랜잭션 구현

#### 1. 트랜잭션 유틸리티 (`src/utils/transaction.ts`)

```typescript
export async function executeTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  timeout: number = TRANSACTION_TIMEOUT.DEFAULT
): Promise<T>
```

**기술적 배경**:
- **Prisma Interactive Transactions**: Prisma 4.7+에서 지원
- **타임아웃 설정**: 기본 5초, 최대 60초
- **자동 롤백**: 에러 발생 시 모든 변경사항 취소
- **에러 처리**: 데드락, 타임아웃, 외래 키 제약 조건 위반 등

#### 2. Repository Adapter 트랜잭션 지원

```typescript
export class FavoriteRepositoryAdapter implements IFavoriteRepository {
  constructor(private readonly tx?: Prisma.TransactionClient) {}
  
  static withTransaction(tx: Prisma.TransactionClient): FavoriteRepositoryAdapter {
    return new FavoriteRepositoryAdapter(tx);
  }
  
  private get client() {
    return this.tx || prisma;
  }
}
```

**특징**:
- 트랜잭션 클라이언트를 선택적으로 받음
- 트랜잭션이 없으면 기본 `prisma` 클라이언트 사용
- `withTransaction` 정적 메서드로 트랜잭션 인스턴스 생성

#### 3. Service 레이어에서 트랜잭션 사용

```typescript
async addFavorite(userId: string, dto: CreateFavoriteDto): Promise<FavoriteResponseDto> {
  return await executeTransaction(
    async (tx) => {
      const stockRepoWithTx = StockRepositoryAdapter.withTransaction(tx);
      const favoriteRepoWithTx = FavoriteRepositoryAdapter.withTransaction(tx);
      
      // 트랜잭션 내에서 작업 수행
      const stock = await stockRepoWithTx.findById(dto.stockId);
      const favorite = await favoriteRepoWithTx.create(...);
      
      return FavoriteResponseDto.to(favorite, stock);
    },
    TRANSACTION_TIMEOUT.DEFAULT
  );
}
```

### 트랜잭션 적용된 메서드

1. **FavoriteService.addFavorite**
   - Stock 조회 + Favorite 생성
   - 중복 체크 + 생성

2. **HistoryService.addHistory**
   - Stock 조회 + History 생성
   - 최근 기록 조회 + 생성

3. **PortfolioService.createPortfolio**
   - 중복 체크 + Stock 조회 + Portfolio 생성

4. **PortfolioService.updatePortfolio**
   - Portfolio 조회 + Stock 조회 + Portfolio 업데이트

### 트랜잭션 에러 처리

```typescript
// 데드락 감지 (P2034)
if (error.code === 'P2034') {
  throw new DatabaseError('Transaction conflict. Please try again.');
}

// 타임아웃 (P2028)
if (error.code === 'P2028') {
  throw new DatabaseError('Transaction timeout. The operation took too long.');
}

// 외래 키 제약 조건 위반 (P2003)
if (error.code === 'P2003') {
  throw new DatabaseError('Invalid reference. Related record does not exist.');
}
```

---

## 데이터베이스 설계

### Prisma Schema (`prisma/schema.prisma`)

#### 주요 엔티티

1. **User**: 사용자 정보
2. **Stock**: 주식 정보
3. **Favorite**: 즐겨찾기 (User ↔ Stock 다대다)
4. **History**: 조회/검색 이력
5. **Portfolio**: 포트폴리오 (보유 종목)
6. **StockPrice**: 주가 데이터 (OHLC)

#### 관계

```
User
├── Favorite (1:N)
├── History (1:N)
└── Portfolio (1:N)

Stock
├── Favorite (1:N)
├── History (1:N)
├── Portfolio (1:N)
└── StockPrice (1:N)
```

### 트랜잭션 격리 수준

PostgreSQL 기본 격리 수준: **READ COMMITTED**

- **특징**:
  - Dirty Read 방지
  - Non-repeatable Read 가능
  - Phantom Read 가능
- **영향**:
  - 동시성 성능 우수
  - 일부 동시성 문제 가능 (트랜잭션으로 해결)

---

## 책임 분리 원칙

### Single Responsibility Principle (SRP)
- 각 레이어는 하나의 책임만 가짐
- 예: Controller는 HTTP 처리만, Service는 비즈니스 로직만

### Dependency Inversion Principle (DIP)
- 고수준 모듈(Service)은 저수준 모듈(Adapter)에 의존하지 않음
- 인터페이스(Repository)에 의존

### Interface Segregation Principle (ISP)
- 클라이언트는 사용하지 않는 인터페이스에 의존하지 않음
- Facade 인터페이스는 필요한 메서드만 정의

### Open/Closed Principle (OCP)
- 확장에는 열려있고, 수정에는 닫혀있음
- 새로운 Repository 구현체 추가 시 기존 코드 수정 불필요

---

## 성능 고려사항

### 1. 트랜잭션 최소화
- 읽기 전용 작업은 트랜잭션 밖에서 수행
- 트랜잭션은 최소한의 시간만 사용

### 2. Connection Pooling
- Prisma는 내부적으로 connection pooling 관리
- `DATABASE_URL`에 `connection_limit` 파라미터 설정 가능

### 3. 타임아웃 설정
- 기본: 5초
- 복잡한 작업: 10초
- 최대: 60초 (Prisma 제한)

---

## 테스트 전략

### 1. Unit Test
- Service 레이어: Mock Repository 주입
- Repository Adapter: Mock Prisma Client

### 2. Integration Test
- 실제 데이터베이스 사용
- 트랜잭션 롤백으로 테스트 격리

### 3. E2E Test
- Fastify 서버 실행
- 실제 HTTP 요청/응답 테스트

---

## 참고 자료

- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [PostgreSQL Isolation Levels](https://www.postgresql.org/docs/current/transaction-iso.html)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

