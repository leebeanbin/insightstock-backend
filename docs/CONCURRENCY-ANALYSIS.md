# 동시성 분석 문서

## 개요
InsightStock Backend의 동시성 체크가 필요한 부분을 분석하고 처리 방안을 제시합니다.

## 동시성 체크가 필요한 부분

### 1. ✅ Favorite 추가/삭제
- **현재 상태**: 트랜잭션으로 처리됨
- **동시성 문제**: 동시에 같은 Stock을 Favorite에 추가할 수 있음
- **해결 방법**: 
  - 트랜잭션 내에서 중복 체크 수행
  - Unique 제약 조건 (`userId_stockId`)으로 데이터베이스 레벨에서 보장
- **상태**: ✅ 완료

### 2. ✅ Portfolio 생성/업데이트
- **현재 상태**: 트랜잭션으로 처리됨
- **동시성 문제**: 
  - 동시에 같은 Stock의 Portfolio를 생성할 수 있음
  - Portfolio 업데이트 시 Stock 가격 변경으로 인한 데이터 일관성 문제
- **해결 방법**:
  - 트랜잭션 내에서 중복 체크 수행
  - Unique 제약 조건 (`userId_stockId`)으로 데이터베이스 레벨에서 보장
  - Stock 조회와 Portfolio 업데이트를 트랜잭션으로 묶어 일관성 보장
- **상태**: ✅ 완료

### 3. ✅ History 추가
- **현재 상태**: 트랜잭션으로 처리됨
- **동시성 문제**: 동시에 같은 History를 생성할 수 있음
- **해결 방법**:
  - 트랜잭션 내에서 최근 기록 조회 및 생성
  - 최근 기록이 있으면 업데이트하지 않고 반환
- **상태**: ✅ 완료

### 4. ⚠️ Note 수정
- **현재 상태**: Prisma의 `update` 사용 (Last Write Wins)
- **동시성 문제**: 동시에 같은 Note를 수정할 수 있음
- **해결 방법**:
  - 현재: WHERE 조건에 `userId` 포함으로 사용자별 격리
  - 매수/매도가 없으므로 민감한 데이터가 아니므로 현재 구조로 충분
  - 필요시 Optimistic Locking (version 필드) 추가 가능
- **상태**: ⚠️ 현재 구조로 충분 (필요시 개선 가능)

### 5. ✅ Chat 대화 생성
- **현재 상태**: 독립적인 대화 생성
- **동시성 문제**: 동시에 같은 대화를 생성할 수 있지만, 각각 독립적인 대화이므로 문제 없음
- **해결 방법**: 
  - 각 요청은 독립적인 대화를 생성
  - 메시지 저장은 순차적으로 처리되므로 동시성 문제 없음
- **상태**: ✅ 문제 없음

## 동시성 체크가 불필요한 부분

### 1. 읽기 작업
- Stock 조회
- News 조회
- Market 데이터 조회
- Portfolio 조회 (읽기 전용)
- History 조회

### 2. 독립적인 생성 작업
- Note 생성 (각 노트는 독립적)
- Chat 메시지 생성 (순차 처리)

## 트랜잭션 적용 현황

### 트랜잭션이 적용된 메서드
1. `FavoriteService.addFavorite` - Stock 조회 + Favorite 생성
2. `HistoryService.addHistory` - Stock 조회 + History 생성
3. `PortfolioService.createPortfolio` - 중복 체크 + Stock 조회 + Portfolio 생성
4. `PortfolioService.updatePortfolio` - Portfolio 조회 + Stock 조회 + Portfolio 업데이트

### 트랜잭션이 불필요한 메서드
1. 읽기 전용 메서드 (조회만 수행)
2. 독립적인 생성 작업 (중복 체크 불필요)

## 결론

**매수/매도 기능이 없으므로 민감한 동시성 문제는 없습니다.**

현재 구조:
- ✅ Favorite, Portfolio, History는 트랜잭션으로 동시성 제어
- ✅ Note 수정은 Last Write Wins 방식 (충분)
- ✅ Chat은 독립적인 대화 생성 (문제 없음)

**추가 개선 사항 (선택적)**:
- Note 수정 시 Optimistic Locking 추가 가능 (version 필드)
- 하지만 현재 구조로도 충분히 안전함

