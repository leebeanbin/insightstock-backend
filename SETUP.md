# InsightStock Backend 설정 가이드

## ✅ 완료된 설정

### 1. 데이터베이스
- ✅ PostgreSQL 데이터베이스 생성 완료
- ✅ Prisma 마이그레이션 완료
- ✅ 테스트용 사용자 생성 완료 (`dev-user-001`)

### 2. 기본 설정
- ✅ 포트: 3001
- ✅ CORS: `http://localhost:3000` 허용
- ✅ 인증: 개발 모드 (더미 사용자 사용)

## 🔑 API 키 설정 필요

### OpenAI API 키 (채팅 기능용)

`.env` 파일에 다음을 추가하세요:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**OpenAI API 키 발급 방법:**
1. https://platform.openai.com/api-keys 접속
2. 계정 생성/로그인
3. "Create new secret key" 클릭
4. 생성된 키를 `.env` 파일에 추가

**채팅 기능 테스트:**
- API 키 설정 후 `/api/chat/stream` 엔드포인트 사용 가능
- 프론트엔드에서 AI 채팅 기능 정상 작동

### Pinecone API 키 (선택사항 - RAG 기능용)

RAG(검색 증강 생성) 기능을 사용하려면:

```bash
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=insightstock
```

**Pinecone API 키 발급 방법:**
1. https://www.pinecone.io/ 접속
2. 계정 생성/로그인
3. API 키 생성
4. `.env` 파일에 추가

## 🧪 테스트 방법

### 1. 데이터베이스 연결 확인

```bash
pnpm db:studio
```

Prisma Studio가 열리면 데이터베이스 내용을 확인할 수 있습니다.

### 2. API 테스트

```bash
# Health check
curl http://localhost:3001/health

# Market data
curl http://localhost:3001/api/market

# Stock search (검색 기능)
curl "http://localhost:3001/api/stocks?search=삼성전자"

# Stock detail
curl http://localhost:3001/api/stocks/005930
```

### 3. 채팅 기능 테스트

OpenAI API 키 설정 후:

```bash
# SSE 스트리밍 테스트
curl -N "http://localhost:3001/api/chat/stream?conversationId=&message=삼성전자에 대해 알려줘"
```

또는 프론트엔드에서 `/chat` 페이지 접속하여 테스트

## 📝 현재 상태

### ✅ 작동하는 기능
- Market API (증시 정보)
- Stock API (종목 정보, 검색)
- Proxy API (네이버 API 프록시)
- Portfolio API (포트폴리오 관리)
- Favorites API (즐겨찾기)
- History API (조회 기록)
- Chat API (OpenAI API 키 설정 시)

### ⚠️ 주의사항
- **인증**: 현재 개발 모드로 더미 사용자(`dev-user-001`) 사용
- **데이터베이스**: PostgreSQL 연결 필요
- **OpenAI**: 채팅 기능 사용 시 API 키 필수

## 🚀 빠른 시작

1. **데이터베이스 확인**
   ```bash
   psql -U leejungbin -d insightstock -c "SELECT COUNT(*) FROM users;"
   ```

2. **서버 실행**
   ```bash
   pnpm dev
   ```

3. **API 키 설정** (채팅 기능 사용 시)
   - `.env` 파일에 `OPENAI_API_KEY` 추가

4. **테스트**
   - 브라우저에서 `http://localhost:3001/health` 접속
   - 프론트엔드에서 종목 검색 및 채팅 테스트

## 🔧 문제 해결

### 데이터베이스 연결 오류
```bash
# 데이터베이스 확인
psql -U leejungbin -d insightstock -c "SELECT 1;"

# 마이그레이션 재실행
pnpm db:push --accept-data-loss
```

### Prisma Client 오류
```bash
pnpm db:generate
```

### OpenAI API 오류
- API 키가 올바른지 확인
- API 키에 충분한 크레딧이 있는지 확인
- `.env` 파일이 제대로 로드되는지 확인

