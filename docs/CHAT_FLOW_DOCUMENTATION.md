# 💬 채팅 플로우 문서

**작성일**: 2025년 12월 15일  
**목적**: 채팅 시작부터 메시지 전송까지의 전체 플로우 설명

---

## 🔄 채팅 시작 플로우

### 1. "New Chat" 버튼 클릭

```
사용자 클릭
  ↓
ConversationList 컴포넌트의 "New Chat" 버튼
  ↓
onCreateNew() 콜백 호출
```

**코드 위치**:
- `components/chat/ConversationList.tsx` (line 102)
- `components/common/FloatingChatButton.tsx` (line 46-65)

---

### 2. 대화 생성 (Conversation Creation)

```
onCreateNew()
  ↓
handleCreateNew()
  ↓
createMutation.mutateAsync({ title: '새 대화' })
  ↓
chatService.createConversation()
  ↓
POST /api/chat/conversations
  ↓
백엔드: ChatService.createConversation()
  ↓
DB에 Conversation 생성 (UUID 형식 ID)
  ↓
반환: { id: "uuid-format-id", title: "새 대화", ... }
```

**중요 사항**:
- ✅ **백엔드에서 UUID 형식 ID 생성** (Prisma `@id @default(uuid())`)
- ✅ **DB에 실제로 저장됨**
- ✅ **임시 ID 생성하지 않음** (fallback 제거됨)

**코드 위치**:
- 프론트엔드: `lib/hooks/use-conversations.ts` (line 41-51)
- 프론트엔드: `lib/services/chat.service.ts` (line 26-32)
- 백엔드: `src/services/ChatService.ts` (line 470-501)

---

### 3. ID 추적 (ID Tracking)

```
대화 생성 성공
  ↓
conversation.id (UUID) 반환
  ↓
setSelectedConversationId(conversation.id)
  ↓
상태 업데이트: selectedConversationId = "uuid-format-id"
  ↓
ChatInterface에 전달: conversationId={selectedConversationId}
```

**추적 방식**:
- **FloatingChatButton**: `useState`로 `selectedConversationId` 관리
- **AILabPage**: `useState`로 `selectedConversationId` 관리
- **ChatInterface**: `conversationId` prop으로 받아서 사용

**코드 위치**:
- `components/common/FloatingChatButton.tsx` (line 25, 53)
- `components/chat/ChatInterface.tsx` (line 30)

---

### 4. 메시지 전송 (Message Sending)

```
사용자가 메시지 입력 후 전송
  ↓
handleSend(content)
  ↓
sendMessage({ conversationId, message: content })
  ↓
SSE 스트리밍: GET /api/chat/stream?conversationId={id}&message={content}
  ↓
백엔드: ChatService.streamChat()
  ↓
메시지 저장 및 응답 스트리밍
```

**중요 사항**:
- ✅ **conversationId가 필수**: `if (!conversationId) return;`
- ✅ **실제 DB에 존재하는 ID만 사용**
- ✅ **임시 ID 사용하지 않음**

**코드 위치**:
- `components/chat/ChatInterface.tsx` (line 94-114)
- `lib/hooks/use-chat.ts` (line 75-216)
- `src/services/ChatService.ts` (line 140-236)

---

## 📊 ID 추적 흐름도

```
┌─────────────────────────────────────────┐
│  사용자: "New Chat" 버튼 클릭          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  onCreateNew() 호출                     │
│  - ConversationList                     │
│  - FloatingChatButton                   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  handleCreateNew()                      │
│  - createMutation.mutateAsync()          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  POST /api/chat/conversations           │
│  { title: "새 대화" }                   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  백엔드: ChatService.createConversation()│
│  - DB에 Conversation 생성               │
│  - UUID 형식 ID 생성                    │
│  - 반환: { id: "uuid-...", ... }        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  setSelectedConversationId(conversation.id)│
│  - 상태 업데이트                        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  ChatInterface에 전달                   │
│  conversationId={selectedConversationId}│
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  메시지 전송 시 conversationId 사용     │
│  - useMessages(conversationId)          │
│  - sendMessage({ conversationId, ... }) │
└─────────────────────────────────────────┘
```

---

## 🔍 ID 형식

### ✅ 올바른 형식 (현재 사용)
- **백엔드 DB**: UUID 형식 (`550e8400-e29b-41d4-a716-446655440000`)
- **Prisma Schema**: `@id @default(uuid())`
- **예시**: `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`

### ❌ 제거된 형식 (이전 fallback)
- ~~`conv_${Date.now()}`~~ - 제거됨
- ~~`conv_1765765796824`~~ - 제거됨

---

## 🎯 핵심 포인트

1. **ID는 백엔드에서 생성**: 프론트엔드에서 임시 ID 생성하지 않음
2. **DB에 실제 저장**: 생성 즉시 DB에 저장되어 추적 가능
3. **상태로 추적**: React `useState`로 `selectedConversationId` 관리
4. **Prop으로 전달**: `ChatInterface`에 `conversationId` prop으로 전달
5. **모든 API 호출에 사용**: 메시지 조회, 전송 등 모든 API에서 사용

---

## 📝 코드 예시

### 대화 생성
```typescript
// FloatingChatButton.tsx
const handleCreateNew = async () => {
  const conversation = await createMutation.mutateAsync({
    title: t('chat.newConversation'),
  });
  setSelectedConversationId(conversation.id); // UUID 형식 ID 저장
};
```

### ID 추적
```typescript
// FloatingChatButton.tsx
const [selectedConversationId, setSelectedConversationId] = useState<string>('');

// ChatInterface에 전달
<ChatInterface 
  conversationId={selectedConversationId || null}
  onCreateNew={handleCreateNew}
/>
```

### 메시지 전송
```typescript
// ChatInterface.tsx
const handleSend = async (content: string) => {
  if (!conversationId) return; // ID가 없으면 전송 불가
  
  await sendMessage({
    conversationId, // UUID 형식 ID 사용
    message: content,
  });
};
```

---

## ✅ 검증 사항

- ✅ "New Chat" 버튼 클릭 시 백엔드 API 호출
- ✅ 백엔드에서 UUID 형식 ID 생성
- ✅ DB에 실제 저장
- ✅ 프론트엔드 상태로 추적
- ✅ ChatInterface에 전달
- ✅ 메시지 전송 시 ID 사용
- ✅ 임시 ID 생성하지 않음

---

**작성자**: AI Assistant  
**프로젝트**: InsightStock Backend/Frontend
