# 🔧 채팅 에러 수정 보고서

**작성일**: 2025년 12월 15일  
**목적**: 채팅 기능의 404 및 SSE 스트리밍 에러 해결

---

## 🐛 발견된 에러

### 1. 404 에러: `/api/chat/conversations/conv_1765765796824/messages`
**에러 메시지**: `Failed to load resource: the server responded with a status of 404 (Not Found)`

**원인**:
- 프론트엔드에서 API 호출 실패 시 fallback으로 `conv_${Date.now()}` 형식의 임시 conversationId 생성
- 백엔드 DB는 UUID 형식 사용 (`@id @default(uuid())`)
- 임시 ID는 DB에 존재하지 않아 404 에러 발생

**위치**:
- `lib/repositories/chat.repository.ts` - `createConversation()` 메서드
- `lib/repositories/chat.repository.ts` - `sendMessage()` 메서드

---

### 2. "Failed to generate chat response" 에러
**에러 메시지**: `Failed to send message Error: Failed to generate chat response`

**원인**:
- SSE 스트리밍 중 에러 발생 시 fallback으로 일반 메시지 전송 시도
- Fallback에서도 임시 conversationId 사용하여 추가 에러 발생
- 에러 메시지가 명확하지 않음

**위치**:
- `lib/hooks/use-chat.ts` - `useSendMessageStream()` Hook
- `src/controllers/ChatController.ts` - `streamChat()` 메서드

---

## ✅ 수정 내용

### 1. 프론트엔드 수정

#### `lib/repositories/chat.repository.ts`
- ✅ **Fallback 제거**: `createConversation()`에서 임시 ID 생성 제거
- ✅ **에러 전파**: 에러를 그대로 전파하여 호출자가 처리하도록 수정
- ✅ **Fallback 제거**: `sendMessage()`에서 임시 메시지 생성 제거

**Before**:
```typescript
catch (error) {
  // Fallback: 임시 대화 생성 (개발용)
  return {
    id: `conv_${Date.now()}`,
    // ...
  };
}
```

**After**:
```typescript
// Fallback 제거: 실제 API 호출만 사용
return await this.post<Conversation>('/conversations', data);
```

#### `lib/hooks/use-chat.ts`
- ✅ **Fallback 제거**: SSE 연결 실패 시 일반 메시지 전송 fallback 제거
- ✅ **타임아웃 처리**: 연결 타임아웃 처리 추가
- ✅ **에러 메시지 개선**: 더 명확한 에러 메시지 제공
- ✅ **중복 코드 제거**: `useRegenerateMessage` 중복 정의 제거

**Before**:
```typescript
eventSource.onerror = (error) => {
  // Fallback: 일반 메시지 전송
  chatService.sendMessage(data)
    .then(resolve)
    .catch(reject);
};
```

**After**:
```typescript
eventSource.onerror = (error) => {
  // SSE 연결 실패 시 에러 반환 (fallback 제거)
  reject(new Error('SSE connection failed. Please try again.'));
};
```

---

### 2. 백엔드 수정

#### `src/controllers/ChatController.ts`
- ✅ **에러 로깅 추가**: 에러 발생 시 로깅 추가
- ✅ **에러 메시지 개선**: 더 명확한 에러 메시지

**Before**:
```typescript
catch (error) {
  reply.raw.write(`data: ${JSON.stringify({
    type: 'error',
    error: error instanceof Error ? error.message : 'Failed to stream chat'
  })}\n\n`);
}
```

**After**:
```typescript
catch (error) {
  logger.error('ChatController.streamChat error:', error);
  const errorMessage = error instanceof Error 
    ? error.message 
    : 'Failed to generate chat response';
  
  reply.raw.write(`data: ${JSON.stringify({
    type: 'error',
    error: errorMessage
  })}\n\n`);
}
```

---

## 📊 수정 효과

### Before
- ❌ 임시 conversationId로 인한 404 에러
- ❌ Fallback으로 인한 추가 에러 발생
- ❌ 에러 메시지가 불명확
- ❌ 디버깅 어려움

### After
- ✅ 실제 DB에 존재하는 conversationId만 사용
- ✅ 에러가 명확하게 전파됨
- ✅ 명확한 에러 메시지
- ✅ 로깅으로 디버깅 용이

---

## 🔍 에러 발생 시나리오

### 시나리오 1: 대화 생성 실패
1. 사용자가 새 대화 생성 시도
2. API 호출 실패
3. **Before**: 임시 ID 생성 → 메시지 조회 시 404
4. **After**: 에러 전파 → 사용자에게 명확한 에러 표시

### 시나리오 2: SSE 연결 실패
1. 사용자가 메시지 전송
2. SSE 연결 실패
3. **Before**: Fallback으로 일반 메시지 전송 → 임시 ID 사용 → 404
4. **After**: 에러 반환 → 사용자에게 재시도 안내

---

## ✅ 검증 사항

- ✅ 임시 conversationId 생성 제거 확인
- ✅ Fallback 제거 확인
- ✅ 에러 처리 개선 확인
- ✅ 로깅 추가 확인
- ✅ 중복 코드 제거 확인

---

## 📝 커밋 정보

### Frontend
- **커밋 ID**: `9c5dcd4`
- **내용**: Remove fallback conversationId generation and improve error handling

### Backend
- **커밋 ID**: `7772055`
- **내용**: Improve error handling in ChatController.streamChat

---

**작성자**: AI Assistant  
**프로젝트**: InsightStock Backend/Frontend
