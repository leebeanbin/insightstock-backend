# 🔧 에러 처리 표준 가이드

**목적**: 모든 서비스에서 일관된 에러 처리 패턴 적용

---

## 📋 에러 처리 원칙

### 1. 에러 타입별 처리 전략

#### 비즈니스 로직 에러 (AppError 상속)
- **용도**: 사용자 입력 오류, 비즈니스 규칙 위반
- **처리**: AppError 상속 클래스 사용 후 상위로 전파
- **예시**: `NotFoundError`, `ConflictError`, `ValidationError`

#### 시스템 에러 (예상치 못한 에러)
- **용도**: 데이터베이스 오류, 네트워크 오류 등
- **처리**: 로깅 후 상위로 전파 (DatabaseError로 래핑)
- **예시**: Prisma 오류, Redis 연결 오류

#### 치명적이지 않은 에러
- **용도**: 캐시 실패, 부가 기능 실패 등
- **처리**: 로깅 후 기본값 반환
- **예시**: 캐시 실패 시 DB 조회, 검색 이력 저장 실패

---

## 🎯 표준 에러 처리 패턴

### 패턴 1: 비즈니스 로직 에러 (상위로 전파)

```typescript
async getResource(id: string, userId: string): Promise<Resource> {
  const resource = await this.repository.findById(id, userId);
  if (!resource) {
    throw new NotFoundError('Resource');
  }
  return resource;
}
```

### 패턴 2: 시스템 에러 (로깅 + 래핑)

```typescript
async createResource(data: CreateResourceDto): Promise<Resource> {
  try {
    return await this.repository.create(data);
  } catch (error) {
    logger.error('ResourceService.createResource error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError('Failed to create resource');
    }
    throw error;
  }
}
```

### 패턴 3: 치명적이지 않은 에러 (기본값 반환)

```typescript
async getCachedData(key: string): Promise<Data[]> {
  try {
    const cached = await cacheService.get<Data[]>(key);
    if (cached) return cached;
    
    const data = await this.repository.findAll();
    await cacheService.set(key, data, 300).catch((error) => {
      logger.warn('Cache set failed (non-critical):', error);
    });
    return data;
  } catch (error) {
    logger.error('ResourceService.getCachedData error:', error);
    // 치명적이지 않으므로 기본값 반환
    return [];
  }
}
```

---

## 📝 서비스별 적용 가이드

### 1. UserActivityService
- ✅ `trackNewsRead`: 치명적이지 않음 → 로깅만 (현재 올바름)
- ✅ `toggleNewsLike`: 비즈니스 로직 → throw error (현재 올바름)
- ✅ `getUserContext`: 치명적이지 않음 → 기본값 반환 (현재 올바름)

### 2. SearchService
- ✅ `searchStocks`: 치명적이지 않음 → 빈 배열 반환 (현재 올바름)
- ✅ `searchNews`: 치명적이지 않음 → 빈 배열 반환 (현재 올바름)
- ✅ `saveSearchHistory`: 치명적이지 않음 → 로깅만 (현재 올바름)

### 3. NoteService
- ⚠️ `createNote`: 일반 Error 사용 → NotFoundError로 변경 필요
- ✅ `updateNote`: NotFoundError 사용 (올바름)
- ✅ `deleteNote`: NotFoundError 사용 (올바름)

### 4. MarketService
- ✅ `getMarketData`: Fallback 전략 (현재 올바름)

---

## 🔄 개선 필요 사항

1. **NoteService.createNote**: 일반 Error → NotFoundError
2. **일관된 에러 메시지 형식**: 리소스명 포함
3. **Prisma 에러 처리**: DatabaseError로 래핑

---

**작성일**: 2025년 12월 15일  
**프로젝트**: InsightStock Backend
