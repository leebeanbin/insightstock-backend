# API 시드 데이터 요구사항

## 개요
모든 API 엔드포인트가 정상적으로 작동하기 위해 필요한 시드 데이터를 정리합니다.

## 1. Stock API (/api/stocks)

### 엔드포인트:
- `GET /api/stocks` - 주식 목록 조회
- `GET /api/stocks/categories` - 카테고리 목록
- `GET /api/stocks/:code` - 주식 상세 정보
- `GET /api/stocks/:code/prices` - 주식 가격 이력

### 필요 데이터:
- ✅ Stock 데이터 (35개)
- ✅ StockPrice 데이터 (365일 일봉 + 시간봉)
- ❌ **문제**: StockPrice 데이터가 실제로 DB에 저장되지 않음

---

## 2. News API (/api/news)

### 엔드포인트:
- `GET /api/news` - 뉴스 목록
- `GET /api/news/:id` - 뉴스 상세

### 필요 데이터:
- ✅ News 데이터 (36개)
- ✅ NewsStock 관계 데이터

---

## 3. Favorite API (/api/favorites)

### 엔드포인트:
- `GET /api/favorites` - 즐겨찾기 목록
- `POST /api/favorites` - 즐겨찾기 추가
- `DELETE /api/favorites/:stockId` - 즐겨찾기 제거
- `GET /api/favorites/:stockId` - 즐겨찾기 여부 확인

### 필요 데이터:
- ✅ Favorite 데이터 (8개)
- ✅ 관련 Stock 데이터

---

## 4. Portfolio API (/api/portfolio)

### 엔드포인트:
- `GET /api/portfolio` - 포트폴리오 목록
- `POST /api/portfolio` - 포트폴리오 추가
- `PUT /api/portfolio/:id` - 포트폴리오 업데이트
- `DELETE /api/portfolio/:id` - 포트폴리오 삭제

### 필요 데이터:
- ✅ Portfolio 데이터 (5개)
- ✅ 관련 Stock 데이터

---

## 5. History API (/api/history)

### 엔드포인트:
- `GET /api/history?type=view` - 조회 기록
- `GET /api/history?type=search` - 검색 기록
- `POST /api/history` - 기록 추가

### 필요 데이터:
- ✅ History 데이터 (10개 조회, 검색)
- ✅ 관련 Stock 데이터

---

## 6. Chat API (/api/chat)

### 엔드포인트:
- `GET /api/chat` - 대화 목록
- `GET /api/chat/:id` - 대화 상세 (메시지 목록)
- `POST /api/chat` - 새 대화 생성
- `POST /api/chat/:id/messages` - 메시지 전송 (스트리밍)

### 필요 데이터:
- ✅ Conversation 데이터 (3개)
- ✅ Message 데이터 (각 대화당 2~4개)

---

## 7. Learning API (/api/learning)

### 엔드포인트:
- `GET /api/learning?category=stock_basics` - 학습 Q&A 목록
- `GET /api/learning/:id` - 학습 Q&A 상세

### 필요 데이터:
- ✅ LearningQA 데이터 (6개)

---

## 8. Note API (/api/notes)

### 엔드포인트:
- `GET /api/notes` - 노트 목록
- `GET /api/notes/:id` - 노트 상세
- `POST /api/notes` - 노트 생성
- `PUT /api/notes/:id` - 노트 업데이트
- `DELETE /api/notes/:id` - 노트 삭제

### 필요 데이터:
- ✅ Note 데이터 (4개)

---

## 9. Market API (/api/market)

### 엔드포인트:
- `GET /api/market` - 시장 데이터 (KOSPI, KOSDAQ)

### 필요 데이터:
- ✅ Stock 데이터에서 계산 (추가 시드 불필요)

---

## 10. Search API (/api/search)

### 엔드포인트:
- `GET /api/search?q=검색어` - 통합 검색
- `GET /api/search/stocks?q=검색어` - 종목 검색
- `GET /api/search/news?q=검색어` - 뉴스 검색
- `GET /api/search/popular` - 인기 검색어
- `GET /api/search/suggestions?q=검색어` - 자동완성

### 필요 데이터:
- ✅ Stock 데이터
- ✅ News 데이터
- ✅ History 데이터 (type='search')

---

## 11. User Activity API (/api/user-activity)

### 엔드포인트:
- `GET /api/user-activity/news-reads` - 뉴스 읽기 기록
- `GET /api/user-activity/news-likes` - 뉴스 좋아요
- `POST /api/user-activity/news-likes` - 뉴스 좋아요 추가
- `DELETE /api/user-activity/news-likes/:newsId` - 뉴스 좋아요 제거
- `GET /api/user-activity/news-bookmarks` - 뉴스 즐겨찾기
- `POST /api/user-activity/news-bookmarks` - 뉴스 즐겨찾기 추가
- `DELETE /api/user-activity/news-bookmarks/:newsId` - 뉴스 즐겨찾기 제거

### 필요 데이터:
- ✅ NewsRead 데이터 (10개)
- ✅ NewsLike 데이터 (5개)
- ✅ NewsBookmark 데이터 (3개)

---

## 12. Image API (/api/images)

### 엔드포인트:
- `POST /api/images/upload` - 이미지 업로드

### 필요 데이터:
- ❌ 업로드 전용 API, 시드 불필요

---

## 주요 문제점

### 1. StockPrice 데이터가 DB에 저장되지 않음 ❗
- **증상**: `/api/stocks/:code/prices` API가 빈 배열 반환
- **원인**: 시드 스크립트는 정상이지만 실행 후 데이터가 사라짐
- **해결 필요**

### 2. 모든 종목에 대한 가격 이력 필요
- 현재 35개 종목 모두 가격 이력 필요
- 365일 일봉 + 당일 시간봉

### 3. 관계 데이터 무결성
- Favorite → Stock
- Portfolio → Stock
- History → Stock
- NewsStock → Stock, News
- 모든 관계가 유효해야 함

---

## 다음 단계

1. ✅ StockPrice 시드 생성 로직 확인
2. ❌ **DB에 실제로 저장되는지 확인 필요**
3. ❌ 모든 API 엔드포인트 테스트
4. ❌ 부족한 시드 데이터 보강

