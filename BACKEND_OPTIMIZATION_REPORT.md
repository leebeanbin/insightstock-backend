# 백엔드 최적화 점검 리포트

## 📋 점검 일자
2024년 현재

## 🔍 점검 항목
1. Redis 캐싱 시스템
2. WebSocket/소켓 시스템
3. 이미지 캐싱 및 처리

---

## 1. Redis 캐싱 시스템

### ✅ 현재 구현 상태

**구현된 부분:**
- ✅ Redis 클라이언트 설정 (`src/config/redis.ts`)
- ✅ CacheService 유틸리티 클래스 (`src/services/CacheService.ts`)
- ✅ 일부 서비스에서 캐싱 사용:
  - `ChatService`: 대화 목록, 메시지 목록 캐싱 (5분, 10분)
  - `SearchService`: 검색 결과, 인기 검색어 캐싱 (5분, 10분)
  - `UserActivityService`: 사용자 컨텍스트 캐싱 (5분)
  - `WebSocketService`: 연결 상태 저장 (1시간)

**캐싱 전략:**
- Cache-Aside 패턴 사용
- TTL 기반 자동 만료
- 패턴 기반 캐시 삭제 지원

### ❌ 개선이 필요한 부분

#### 1.1 주식 데이터 캐싱 부재
**문제점:**
- `StockService`에 캐싱이 전혀 적용되지 않음
- 매 요청마다 DB 조회 발생
- 실시간 주가 데이터도 캐싱되지 않음

**개선 방안:**
```typescript
// src/services/StockService.ts에 추가
import { cacheService } from './CacheService';

async getStockByCode(code: string): Promise<StockDetailResponseDto> {
  const cacheKey = `stock:${code}`;
  
  // 캐시 확인 (1분 TTL)
  const cached = await cacheService.get<StockDetailResponseDto>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // DB 조회
  const stock = await this.stockRepo.findByCode(code);
  const result = StockDetailResponseDto.to(stock);
  
  // 캐시 저장
  await cacheService.set(cacheKey, result, 60); // 1분
  
  return result;
}

async getStockPrices(stockId: string, period: string) {
  const cacheKey = `stock:prices:${stockId}:${period}`;
  
  // 실시간 데이터는 10초, 과거 데이터는 1분
  const ttl = period === '1d' ? 10 : 60;
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;
  
  const prices = await this.stockRepo.findPrices(stockId, period);
  await cacheService.set(cacheKey, prices, ttl);
  
  return prices;
}
```

#### 1.2 뉴스 데이터 캐싱 부재
**문제점:**
- `NewsService`에 캐싱이 전혀 적용되지 않음
- 뉴스 목록 조회 시 매번 DB 쿼리 발생
- 뉴스 상세 조회도 캐싱되지 않음

**개선 방안:**
```typescript
// src/services/NewsService.ts에 추가
async getNews(params: {...}): Promise<{...}> {
  // 캐시 키 생성 (파라미터 기반)
  const cacheKey = `news:list:${JSON.stringify(params)}`;
  
  // 뉴스 목록은 5분 캐시
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;
  
  const result = await this.newsRepository.findMany(params);
  await cacheService.set(cacheKey, result, 300); // 5분
  
  return result;
}

async getNewsById(id: string): Promise<NewsDetailResponseDto> {
  const cacheKey = `news:detail:${id}`;
  
  // 뉴스 상세는 10분 캐시
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;
  
  const news = await this.newsRepository.findById(id);
  await cacheService.set(cacheKey, news, 600); // 10분
  
  return news;
}
```

#### 1.3 시장 데이터 캐싱 부재
**문제점:**
- `MarketService`에 캐싱이 전혀 적용되지 않음
- WebSocket에서 10초마다 호출되는데 매번 계산 수행
- 실시간 데이터이지만 짧은 캐시(5-10초) 적용 가능

**개선 방안:**
```typescript
// src/services/MarketService.ts에 추가
async getMarketData(): Promise<MarketResponseDto> {
  const cacheKey = 'market:data';
  
  // 실시간 데이터는 5초 캐시
  const cached = await cacheService.get<MarketResponseDto>(cacheKey);
  if (cached) return cached;
  
  // 데이터 계산
  const data = { /* ... */ };
  const result = MarketResponseDto.to(data);
  
  // 5초 캐시
  await cacheService.set(cacheKey, result, 5);
  
  return result;
}
```

#### 1.4 캐시 무효화 전략 부족
**문제점:**
- 데이터 업데이트 시 관련 캐시가 자동으로 무효화되지 않음
- 포트폴리오 추가/삭제 시 관련 캐시가 남아있을 수 있음

**개선 방안:**
```typescript
// src/services/PortfolioService.ts에 추가
async createPortfolio(userId: string, data: {...}) {
  const portfolio = await this.portfolioRepo.create(userId, data);
  
  // 관련 캐시 무효화
  await cacheService.delete(`portfolio:list:${userId}`);
  await cacheService.delete(`portfolio:summary:${userId}`);
  
  return portfolio;
}

async updatePortfolio(userId: string, id: string, data: {...}) {
  const portfolio = await this.portfolioRepo.update(id, userId, data);
  
  // 관련 캐시 무효화
  await cacheService.delete(`portfolio:${id}`);
  await cacheService.delete(`portfolio:list:${userId}`);
  await cacheService.deletePattern(`portfolio:*:${userId}`);
  
  return portfolio;
}
```

#### 1.5 Redis 연결 풀 최적화 부족
**문제점:**
- 단일 Redis 클라이언트만 사용
- 연결 풀 설정이 없음
- 다중 서버 환경에서 문제 발생 가능

**개선 방안:**
```typescript
// src/config/redis.ts 개선
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  // 연결 풀 설정 추가
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: false,
  // 연결 풀 크기 설정
  lazyConnect: false,
  keepAlive: 30000,
  // 클러스터 모드 지원
  ...(process.env.REDIS_CLUSTER === 'true' && {
    enableOfflineQueue: false,
    redisOptions: {
      maxRetriesPerRequest: null,
    },
  }),
};
```

---

## 2. WebSocket/소켓 시스템

### ✅ 현재 구현 상태

**구현된 부분:**
- ✅ WebSocket 서비스 구현 (`src/services/WebSocketService.ts`)
- ✅ 채팅용 WebSocket (`/api/chat/ws`)
- ✅ 시장 데이터용 WebSocket (`/api/market/stream`)
- ✅ 하트비트 메커니즘 (30초마다)
- ✅ 연결 상태 관리 (Redis에 저장)
- ✅ 자동 재연결 처리

**특징:**
- 연결별 하트비트 체크
- 타임아웃 처리 (60초)
- 에러 핸들링

### ❌ 개선이 필요한 부분

#### 2.1 다중 서버 환경 지원 부족
**문제점:**
- 연결 정보가 메모리(Map)에만 저장됨
- 다중 서버 환경에서 다른 서버의 연결에 메시지 전송 불가
- Redis에 연결 정보는 저장하지만 활용하지 않음

**개선 방안:**
```typescript
// src/services/WebSocketService.ts 개선
async sendToUser(userId: string, message: any) {
  // 1. 로컬 연결 확인
  for (const [connectionId, connection] of this.connections.entries()) {
    if (connection.userId === userId) {
      this.send(connection.socket, message);
    }
  }
  
  // 2. 다른 서버의 연결 확인 (Redis Pub/Sub 사용)
  const connectionKeys = await redis.keys(`ws:connection:*`);
  for (const key of connectionKeys) {
    const storedUserId = await redis.get(key);
    if (storedUserId === userId) {
      // Redis Pub/Sub으로 메시지 전송
      await redis.publish(`ws:message:${userId}`, JSON.stringify(message));
    }
  }
}

// Redis Pub/Sub 구독 추가
private async setupRedisPubSub() {
  const subscriber = redis.duplicate();
  await subscriber.subscribe('ws:message:*');
  
  subscriber.on('message', (channel, message) => {
    const userId = channel.replace('ws:message:', '');
    // 로컬 연결에 메시지 전송
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.userId === userId) {
        this.send(connection.socket, JSON.parse(message));
      }
    }
  });
}
```

#### 2.2 연결 수 제한 부재
**문제점:**
- 사용자당 연결 수 제한이 없음
- 동일 사용자가 여러 기기에서 연결 시 리소스 낭비
- DDoS 공격에 취약

**개선 방안:**
```typescript
// src/services/WebSocketService.ts에 추가
private readonly MAX_CONNECTIONS_PER_USER = 5;

async handleConnection(socket: WebSocketSocket, userId: string) {
  // 사용자별 연결 수 확인
  const userConnections = Array.from(this.connections.values())
    .filter(conn => conn.userId === userId);
  
  if (userConnections.length >= this.MAX_CONNECTIONS_PER_USER) {
    // 가장 오래된 연결 종료
    const oldestConnection = userConnections
      .sort((a, b) => a.lastPing - b.lastPing)[0];
    oldestConnection.socket.close(1008, 'Too many connections');
  }
  
  // 새 연결 처리
  // ...
}
```

#### 2.3 메시지 큐 크기 제한 부재
**문제점:**
- 클라이언트가 메시지를 받지 못할 때 큐가 무한정 증가
- 메모리 누수 가능성

**개선 방안:**
```typescript
// 연결별 메시지 큐 추가
interface Connection {
  socket: WebSocketSocket;
  userId: string;
  conversationId?: string;
  lastPing: number;
  isAlive: boolean;
  messageQueue: any[]; // 메시지 큐 추가
  maxQueueSize: number; // 최대 큐 크기
}

// 메시지 전송 시 큐 확인
private send(socket: WebSocketSocket, data: any, connection?: Connection) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(data));
  } else if (connection) {
    // 연결이 닫혔으면 큐에 추가
    if (connection.messageQueue.length < connection.maxQueueSize) {
      connection.messageQueue.push(data);
    } else {
      logger.warn(`Message queue full for connection ${connection.userId}`);
    }
  }
}
```

#### 2.4 시장 데이터 WebSocket 최적화 부족
**문제점:**
- 각 연결마다 독립적인 interval 실행
- 동일한 데이터를 여러 연결에 중복 전송
- 리소스 낭비

**개선 방안:**
```typescript
// src/routes/MarketRoutes.ts 개선
// 전역 interval 사용 (모든 연결이 공유)
let globalMarketInterval: NodeJS.Timeout | null = null;
let marketSubscribers: Set<WebSocket> = new Set();
let lastMarketData: any = null;

fastify.get('/stream', { websocket: true }, async (connection: any) => {
  const socket = connection?.socket || connection;
  marketSubscribers.add(socket);
  
  // 초기 데이터 전송
  if (lastMarketData) {
    socket.send(JSON.stringify(lastMarketData));
  }
  
  // 전역 interval 시작 (한 번만)
  if (!globalMarketInterval) {
    globalMarketInterval = setInterval(async () => {
      const data = await marketFacade.getMarketData();
      lastMarketData = {
        kospi: data.kospi,
        kosdaq: data.kosdaq,
        usdKrw: data.usdKrw,
      };
      
      // 모든 구독자에게 브로드캐스트
      marketSubscribers.forEach(subscriber => {
        if (subscriber.readyState === 1) {
          subscriber.send(JSON.stringify(lastMarketData));
        } else {
          marketSubscribers.delete(subscriber);
        }
      });
    }, 10000);
  }
  
  socket.on('close', () => {
    marketSubscribers.delete(socket);
    // 마지막 구독자가 나가면 interval 정리
    if (marketSubscribers.size === 0 && globalMarketInterval) {
      clearInterval(globalMarketInterval);
      globalMarketInterval = null;
    }
  });
});
```

---

## 3. 이미지 캐싱 및 처리

### ✅ 현재 구현 상태

**구현된 부분:**
- ✅ 이미지 최적화 서비스 (`src/services/ImageService.ts`)
- ✅ Sharp 라이브러리 사용 (리사이징, 포맷 변환)
- ✅ WebP 변환 지원
- ✅ 썸네일 생성 기능
- ✅ 이미지 메타데이터 조회

**특징:**
- 최대 크기 제한 (1920x1080)
- 품질 설정 (85%)
- 썸네일 크기 (400x300)

### ❌ 개선이 필요한 부분

#### 3.1 이미지 캐싱 부재
**문제점:**
- 최적화된 이미지가 파일 시스템에만 저장됨
- 동일 이미지 재요청 시 재처리 발생
- CDN 연동 없음

**개선 방안:**
```typescript
// src/services/ImageService.ts에 추가
import { cacheService } from './CacheService';
import crypto from 'crypto';

async optimizeAndSave(buffer: Buffer, originalName: string, options?: {...}) {
  // 이미지 해시 생성 (중복 확인용)
  const imageHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const cacheKey = `image:hash:${imageHash}`;
  
  // 캐시 확인
  const cached = await cacheService.get<{path: string; url: string; ...}>(cacheKey);
  if (cached) {
    logger.info(`ImageService: Cache hit for hash ${imageHash}`);
    return cached;
  }
  
  // 이미지 최적화
  const result = await this.processImage(buffer, originalName, options);
  
  // 캐시 저장 (30일)
  await cacheService.set(cacheKey, result, 30 * 24 * 60 * 60);
  
  return result;
}
```

#### 3.2 CDN 연동 부재
**문제점:**
- 이미지가 로컬 서버에만 저장됨
- CDN을 통한 글로벌 배포 없음
- 이미지 로딩 속도 저하

**개선 방안:**
```typescript
// src/services/ImageService.ts에 CDN 지원 추가
private getImageUrl(filename: string): string {
  // CDN URL 우선 사용
  if (process.env.CDN_BASE_URL) {
    return `${process.env.CDN_BASE_URL}/${filename}`;
  }
  
  // 로컬 URL
  const baseUrl = process.env.IMAGE_BASE_URL || '/uploads';
  return `${baseUrl}/${filename}`;
}

// Cloudinary, AWS S3 등 연동
async uploadToCDN(filePath: string, filename: string): Promise<string> {
  if (process.env.CDN_PROVIDER === 'cloudinary') {
    // Cloudinary 업로드
    const cloudinary = require('cloudinary').v2;
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'insightstock',
      public_id: filename.replace(/\.[^/.]+$/, ''),
    });
    return result.secure_url;
  }
  
  // 기본: 로컬 URL 반환
  return this.getImageUrl(filename);
}
```

#### 3.3 이미지 리사이징 캐시 부재
**문제점:**
- 동일 이미지의 다른 크기 요청 시 재처리
- 반응형 이미지 제공 시 비효율적

**개선 방안:**
```typescript
// 다양한 크기의 이미지 생성 및 캐싱
async getResizedImage(originalPath: string, width: number, height: number): Promise<string> {
  const cacheKey = `image:resized:${originalPath}:${width}x${height}`;
  
  // 캐시 확인
  const cached = await cacheService.get<string>(cacheKey);
  if (cached) return cached;
  
  // 리사이징
  const resizedPath = await this.resizeImage(originalPath, width, height);
  const url = this.getImageUrl(path.basename(resizedPath));
  
  // 캐시 저장
  await cacheService.set(cacheKey, url, 7 * 24 * 60 * 60); // 7일
  
  return url;
}
```

#### 3.4 이미지 만료 정리 작업 부재
**문제점:**
- 사용하지 않는 이미지가 계속 저장됨
- 디스크 공간 낭비
- 정리 작업이 없음

**개선 방안:**
```typescript
// src/services/ImageService.ts에 추가
// 주기적으로 사용하지 않는 이미지 정리
async cleanupUnusedImages() {
  const allImages = await fs.readdir(this.uploadDir);
  const usedImages = await this.getUsedImagePaths(); // DB에서 사용 중인 이미지 조회
  
  for (const image of allImages) {
    if (!usedImages.includes(image)) {
      const imagePath = path.join(this.uploadDir, image);
      const stats = await fs.stat(imagePath);
      const daysSinceModified = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      
      // 30일 이상 사용되지 않은 이미지 삭제
      if (daysSinceModified > 30) {
        await this.deleteImage(imagePath);
        logger.info(`Deleted unused image: ${image}`);
      }
    }
  }
}

// Cron job으로 주기적 실행
// src/jobs/imageCleanup.ts
import cron from 'node-cron';

cron.schedule('0 2 * * 0', async () => {
  // 매주 일요일 새벽 2시에 실행
  await imageService.cleanupUnusedImages();
});
```

#### 3.5 이미지 최적화 레벨 조정 부족
**문제점:**
- 모든 이미지에 동일한 품질(85%) 적용
- 용도별 최적화 없음

**개선 방안:**
```typescript
// 용도별 최적화 설정
private getOptimizationSettings(purpose: 'thumbnail' | 'preview' | 'full'): {
  quality: number;
  format: 'webp' | 'jpeg' | 'png';
} {
  switch (purpose) {
    case 'thumbnail':
      return { quality: 70, format: 'webp' };
    case 'preview':
      return { quality: 80, format: 'webp' };
    case 'full':
      return { quality: 85, format: 'webp' };
  }
}
```

---

## 📊 종합 개선 우선순위

### 🔴 높은 우선순위 (즉시 개선 필요)
1. **주식 데이터 캐싱 추가** - 가장 자주 조회되는 데이터
2. **뉴스 데이터 캐싱 추가** - DB 부하가 큰 쿼리
3. **시장 데이터 캐싱 추가** - WebSocket에서 자주 호출됨
4. **이미지 해시 기반 캐싱** - 중복 처리 방지

### 🟡 중간 우선순위 (단기 개선)
5. **캐시 무효화 전략 강화** - 데이터 일관성 보장
6. **WebSocket 다중 서버 지원** - 확장성 향상
7. **시장 데이터 WebSocket 최적화** - 리소스 효율성

### 🟢 낮은 우선순위 (장기 개선)
8. **CDN 연동** - 글로벌 배포
9. **이미지 정리 작업** - 디스크 관리
10. **연결 수 제한** - 보안 강화

---

## 🛠️ 구현 가이드

### 1단계: 기본 캐싱 추가
```typescript
// src/utils/cache-helper.ts (새 파일 생성)
import { cacheService } from '../services/CacheService';

export async function getOrCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  const cached = await cacheService.get<T>(key);
  if (cached) {
    return cached;
  }
  
  const data = await fetcher();
  await cacheService.set(key, data, ttl);
  
  return data;
}
```

### 2단계: 서비스별 캐싱 적용
각 서비스의 주요 메서드에 `getOrCache` 헬퍼 적용

### 3단계: 캐시 무효화 추가
데이터 변경 시 관련 캐시 삭제 로직 추가

### 4단계: 모니터링 추가
```typescript
// 캐시 히트율 모니터링
let cacheHits = 0;
let cacheMisses = 0;

export async function getOrCacheWithMetrics<T>(...) {
  const cached = await cacheService.get<T>(key);
  if (cached) {
    cacheHits++;
    return cached;
  }
  
  cacheMisses++;
  // ...
}

// 주기적으로 히트율 로깅
setInterval(() => {
  const hitRate = cacheHits / (cacheHits + cacheMisses) * 100;
  logger.info(`Cache hit rate: ${hitRate.toFixed(2)}%`);
}, 60000);
```

---

## 📝 참고사항

- Redis 연결 실패 시 서비스는 계속 동작해야 함 (graceful degradation)
- 캐시는 성능 최적화를 위한 것이지 필수 기능이 아님
- 프로덕션 환경에서는 Redis 클러스터 사용 권장
- 이미지 CDN은 Cloudflare, AWS CloudFront 등 고려

