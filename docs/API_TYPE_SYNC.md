# 🔄 API 타입 동기화 문서

**작성일**: 2025년 12월 15일  
**목적**: 프론트엔드와 백엔드 간 API 타입 일치성 확인 및 유지

---

## 📋 타입 일치성 확인

### ✅ createConversation

#### 백엔드 응답
```typescript
// ChatController.createConversation
{
  success: true,
  data: ConversationResponseDto {
    id: string;              // UUID 형식
    title: string;
    lastMessage: string;     // 빈 문자열 (새 대화)
    category?: string;
    tags: string[];
    createdAt: Date;         // ISO string으로 직렬화
    updatedAt: Date;         // ISO string으로 직렬화
  }
}
```

#### 프론트엔드 기대
```typescript
// chat.repository.ts
Conversation {
  id: string;
  userId: string;             // 백엔드에서 제공하지 않음 (빈 문자열로 변환)
  title: string;
  createdAt: string;          // ISO string
  updatedAt: string;          // ISO string
}
```

#### 변환 로직
```typescript
// chat.repository.ts - createConversation
const backendResponse = await this.post<BackendConversationResponse>('/conversations', data);
return {
  id: backendResponse.id,
  userId: '', // 백엔드에서 제공하지 않음
  title: backendResponse.title,
  createdAt: backendResponse.createdAt,
  updatedAt: backendResponse.updatedAt,
};
```

---

### ✅ getConversations

#### 백엔드 응답
```typescript
// ChatController.getConversations
{
  success: true,
  data: ConversationResponseDto[] {
    id: string;
    title: string;
    lastMessage: string;
    category?: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
  }[]
}
```

#### 프론트엔드 기대
```typescript
// ConversationsListResponse
{
  conversations: ConversationListItem[] {
    id: string;
    title: string;
    lastMessage: string;
    updatedAt: string;
  }[];
  total: number;
}
```

#### 변환 로직
```typescript
// chat.repository.ts - getConversations
const backendConversations = await this.get<BackendConversation[]>('/conversations', params);
const conversations: ConversationListItem[] = backendConversations.map(c => ({
  id: c.id,
  title: c.title,
  lastMessage: c.lastMessage || '',
  updatedAt: c.updatedAt,
}));
return { conversations, total: conversations.length };
```

---

### ✅ getMessages

#### 백엔드 응답
```typescript
// ChatController.getMessages
{
  success: true,
  data: ChatResponseDto[] {
    conversationId: string;
    message: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      sources: string[];
      createdAt: Date;       // ISO string으로 직렬화
    };
  }[]
}
```

#### 프론트엔드 기대
```typescript
// MessagesListResponse
{
  messages: Message[] {
    id: string;
    conversationId: string;
    userId: string;           // 백엔드에서 제공하지 않음 (빈 문자열)
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;        // ISO string
    sources?: string[];
  }[];
  hasMore: boolean;
}
```

#### 변환 로직
```typescript
// chat.repository.ts - getMessages
const backendMessages = await this.get<BackendChatResponse[]>(...);
const messages: Message[] = backendMessages.map(m => ({
  id: m.message.id,
  conversationId: m.conversationId,
  userId: '', // 백엔드가 제공하지 않으므로 빈 문자열
  role: m.message.role,
  content: m.message.content,
  createdAt: m.message.createdAt,
  sources: m.message.sources.length > 0 ? m.message.sources : undefined,
}));
return { messages, hasMore: false };
```

---

## 🔑 API Key 설정

### OpenAI API Key

#### 백엔드 설정
```typescript
// src/services/ChatService.ts
this.openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});
```

#### 환경 변수 파일
```bash
# .env 파일 (백엔드 루트 디렉토리)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

#### 설정 방법
1. **백엔드 루트 디렉토리에 `.env` 파일 생성**
2. **OpenAI API Key 추가**:
   ```bash
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
   ```
3. **`.env` 파일은 Git에 커밋하지 않음** (`.gitignore`에 포함)
4. **`.env.example` 파일에 예시만 포함**:
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   ```

#### 보안 주의사항
- ✅ `.env` 파일은 절대 Git에 커밋하지 않음
- ✅ 프로덕션 환경에서는 환경 변수 관리 시스템 사용 (AWS Secrets Manager, Azure Key Vault 등)
- ✅ API Key는 백엔드에서만 사용 (프론트엔드에 노출하지 않음)
- ✅ `.env.example`에는 실제 키가 아닌 예시만 포함

---

## 📝 타입 동기화 체크리스트

### createConversation
- [x] 백엔드: ConversationResponseDto 반환
- [x] 프론트엔드: Conversation 타입으로 변환
- [x] userId는 빈 문자열로 처리 (백엔드에서 제공하지 않음)
- [x] Date → string 변환 (ISO 형식)

### getConversations
- [x] 백엔드: ConversationResponseDto[] 반환
- [x] 프론트엔드: ConversationListItem[]로 변환
- [x] total 필드 추가 (프론트엔드에서 계산)

### getMessages
- [x] 백엔드: ChatResponseDto[] 반환
- [x] 프론트엔드: Message[]로 변환
- [x] userId는 빈 문자열로 처리
- [x] sources는 배열이 비어있으면 undefined

---

## 🔍 타입 불일치 시 확인 사항

1. **백엔드 DTO 변경 시**:
   - 프론트엔드 변환 로직 업데이트 필요
   - 타입 정의 업데이트 필요

2. **프론트엔드 타입 변경 시**:
   - 백엔드 DTO와 호환성 확인
   - 변환 로직 업데이트 필요

3. **새 필드 추가 시**:
   - 백엔드 DTO에 추가
   - 프론트엔드 타입에 추가
   - 변환 로직에 매핑 추가

---

## 📚 관련 파일

### 백엔드
- `src/dto/chat/ChatResponseDto.ts` - DTO 정의
- `src/controllers/ChatController.ts` - API 엔드포인트
- `src/services/ChatService.ts` - 비즈니스 로직

### 프론트엔드
- `lib/types/api/chat.types.ts` - 타입 정의
- `lib/repositories/chat.repository.ts` - API 호출 및 변환
- `lib/services/chat.service.ts` - 비즈니스 로직

---

**작성자**: AI Assistant  
**프로젝트**: InsightStock Backend/Frontend
