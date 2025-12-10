# 🚀 빠른 시작 가이드

## 1단계: 데이터베이스 확인 (이미 완료됨 ✅)

데이터베이스와 테이블이 이미 생성되어 있습니다.

## 2단계: API 키 설정

### OpenAI API 키 (채팅 기능 필수)

`.env` 파일을 열고 다음 줄을 찾아서:

```bash
OPENAI_API_KEY=sk-your-key-here
```

실제 OpenAI API 키로 변경하세요:

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
```

**API 키 발급:**
1. https://platform.openai.com/api-keys 접속
2. 로그인 후 "Create new secret key" 클릭
3. 생성된 키를 복사하여 `.env` 파일에 붙여넣기

## 3단계: 서버 실행

```bash
pnpm dev
```

서버가 `http://localhost:3001`에서 실행됩니다.

## 4단계: 테스트

### 브라우저에서 테스트

1. **Health Check**: http://localhost:3001/health
2. **Market Data**: http://localhost:3001/api/market
3. **Stock Search**: http://localhost:3001/api/stocks?search=삼성전자
4. **Stock Detail**: http://localhost:3001/api/stocks/005930

### 프론트엔드에서 테스트

1. 프론트엔드 실행: `cd ../insightstock-frontend && pnpm dev`
2. 브라우저에서 http://localhost:3000 접속
3. 대시보드에서 종목 검색 테스트
4. 채팅 페이지에서 AI 채팅 테스트 (OpenAI API 키 필요)

## ✅ 작동 확인 체크리스트

- [x] 데이터베이스 연결
- [x] 테이블 생성
- [x] 테스트 사용자 생성
- [ ] OpenAI API 키 설정 (채팅 기능용)
- [ ] 종목 검색 테스트
- [ ] 종목 상세 정보 테스트
- [ ] AI 채팅 테스트

## 🔧 문제 해결

### 데이터베이스 연결 오류
```bash
# 데이터베이스 확인
psql -U leejungbin -d insightstock -c "SELECT 1;"

# 마이그레이션 재실행
pnpm db:push --accept-data-loss
```

### OpenAI API 오류
- API 키가 올바른지 확인
- API 키에 충분한 크레딧이 있는지 확인
- `.env` 파일이 제대로 로드되는지 확인

### 검색 결과가 비어있음
- 네이버 API가 차단되었을 수 있음
- 로컬 검색으로 자동 폴백됨 (인기 종목만 검색 가능)

