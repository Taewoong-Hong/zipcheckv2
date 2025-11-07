# Chat Architecture Documentation

## Overview

집체크(ZipCheck) 채팅 시스템은 **IndexedDB 기반 로컬 캐시**와 **Supabase 기반 서버 저장소**를 결합한 하이브리드 아키텍처를 사용합니다. 이를 통해 빠른 응답 속도, 오프라인 지원, 그리고 안정적인 데이터 지속성을 동시에 제공합니다.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                   │
│                                                               │
│  ┌───────────────┐         ┌──────────────┐                 │
│  │ ChatInterface │ ◄────► │ chatStorage  │                 │
│  │  (React)      │         │ (IndexedDB)  │                 │
│  └───────────────┘         └──────────────┘                 │
│         │                          │                          │
│         │ User Input               │ CRUD Operations          │
│         ▼                          ▼                          │
│  ┌─────────────────────────────────────┐                    │
│  │         API Routes                   │                    │
│  │  /api/chat/init                     │                    │
│  │  /api/chat/message (POST)           │                    │
│  │  /api/chat/stream/:id (SSE)         │                    │
│  │  /api/chat/message/:id/finalize     │                    │
│  └─────────────────────────────────────┘                    │
└───────────────────────────┬─────────────────────────────────┘
                             │ HTTP/SSE
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                         │
│                                                               │
│  ┌──────────────────┐         ┌─────────────────┐          │
│  │  Chat Router     │ ◄────► │  Supabase       │          │
│  │  (routes/chat.py)│         │  PostgreSQL     │          │
│  └──────────────────┘         └─────────────────┘          │
│                                       │                       │
│  Tables:                              │                       │
│  - conversations (방 정보)            │                       │
│  - messages (메시지)                  │                       │
│  - message_chunks (스트리밍 청크)     │                       │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Layer

#### 1.1 ChatInterface Component (`apps/web/components/chat/ChatInterface.tsx`)

**역할**: 채팅 UI 렌더링 및 사용자 인터랙션 처리

**주요 기능**:
- 메시지 목록 렌더링 (Message 컴포넌트 사용)
- 사용자 입력 처리 (ChatInput 컴포넌트 사용)
- 모달 시스템 통합 (주소 검색, 계약 유형 선택 등)
- 분석 플로우 상태 관리 (StateMachine)

**상태 관리**:
```typescript
const [messages, setMessages] = useState<MessageType[]>([]);
const [conversationId, setConversationId] = useState<string | null>(null);
const [stateMachine] = useState(() => new StateMachine('init'));
```

**메시지 전송 플로우**:
```typescript
1. 사용자 입력 → handleSubmit()
2. 로컬 상태 업데이트 (setMessages)
3. API 호출 (/api/chat)
4. SSE 스트리밍 수신 (response.body.getReader())
5. 실시간 메시지 업데이트
```

#### 1.2 ChatStorage (`apps/web/lib/chatStorage.ts`)

**역할**: IndexedDB 기반 로컬 캐시 및 Supabase 동기화

**핵심 기능**:

1. **IndexedDB 관리**
   - 데이터베이스 이름: `zipcheck_chat`
   - Object Stores:
     - `sessions`: 채팅 세션 메타데이터
     - `messages`: 개별 메시지 (인덱싱 최적화)

2. **Idempotency (중복 방지)**
   - ULID 기반 클라이언트 메시지 ID 생성
   - `client_message_id` 헤더로 중복 전송 방지

3. **SSE 스트리밍 구독**
   ```typescript
   private subscribeToMessageStream(messageId: number): void {
     const eventSource = new EventSource(`/api/chat/stream/${messageId}`);

     eventSource.addEventListener('chunk', async (event) => {
       const data = JSON.parse(event.data);
       await this.updateStreamingMessage(messageId, data.delta);
     });

     eventSource.addEventListener('done', async (event) => {
       await this.finalizeMessage(messageId);
       eventSource.close();
     });
   }
   ```

4. **서버 동기화**
   - 로그인 시: `syncFromServer(accessToken)` 호출 → 기존 대화 복원
   - 메시지 전송 시: `syncMessageToServer(message)` → Supabase에 저장

**주요 메서드**:
- `createSession(firstMessage?, conversationId?)`: 새 세션 생성
- `addMessage(message, syncToServer)`: 메시지 추가 (로컬 + 서버)
- `getAllSessions()`: 모든 세션 조회 (IndexedDB)
- `syncFromServer(accessToken)`: 서버에서 데이터 동기화

### 2. Backend Layer

#### 2.1 Chat Router (`services/ai/routes/chat.py`)

**엔드포인트 목록**:

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/chat/init` | 새 대화 세션 생성 |
| POST | `/chat/message` | 메시지 전송 (idempotent) |
| GET | `/chat/stream/:message_id` | SSE 스트리밍 (실시간 AI 응답) |
| POST | `/chat/message/:id/finalize` | 스트리밍 종료 및 청크 병합 |
| GET | `/chat/conversations` | 사용자 대화 목록 조회 |
| GET | `/chat/conversation/:id/messages` | 대화 메시지 조회 |

#### 2.2 POST /chat/message (Idempotent Message Creation)

**Idempotency 구현**:
```python
@router.post("/message")
async def send_message(
    request: SendMessageRequest,
    user: dict = Depends(get_current_user),
    x_idempotency_key: Optional[str] = Header(None)
):
    # 1. Idempotency key 확인
    idempotency_key = request.client_message_id or x_idempotency_key

    # 2. 중복 메시지 체크
    if idempotency_key:
        existing = supabase.table("messages") \
            .select("*") \
            .eq("conversation_id", request.conversation_id) \
            .execute()

        for msg in (existing.data or []):
            meta = msg.get("meta") or {}
            if meta.get("client_message_id") == idempotency_key:
                # 중복 → 기존 메시지 반환
                return {
                    "ok": True,
                    "message_id": msg["id"],
                    "idempotent": True
                }

    # 3. 신규 메시지 저장
    message_data = {
        "conversation_id": request.conversation_id,
        "role": "user",
        "content": request.content,
        "meta": {
            "client_message_id": idempotency_key
        }
    }
    result = supabase.table("messages").insert(message_data).execute()
```

**응답 형식**:
```json
{
  "ok": true,
  "message_id": 123,
  "conversation_id": "uuid-1234",
  "idempotent": false
}
```

#### 2.3 GET /chat/stream/:message_id (SSE Streaming)

**SSE (Server-Sent Events) 스트리밍**:
```python
@router.get("/stream/{message_id}")
async def stream_message(message_id: int, user: dict = Depends(get_current_user)):
    async def event_generator() -> AsyncGenerator[str, None]:
        last_seq = -1
        max_poll_count = 300  # 최대 5분 (1초 간격)

        while poll_count < max_poll_count:
            # 1. 새 청크 조회
            chunks = supabase.table("message_chunks") \
                .select("seq, delta, created_at") \
                .eq("message_id", message_id) \
                .gt("seq", last_seq) \
                .order("seq", desc=False) \
                .execute()

            # 2. SSE 형식으로 전송
            for chunk in chunks.data or []:
                data = {
                    "seq": chunk["seq"],
                    "delta": chunk["delta"],
                    "timestamp": chunk["created_at"]
                }
                yield f"event: chunk\ndata: {json.dumps(data)}\n\n"
                last_seq = chunk["seq"]

            # 3. 완료 여부 확인
            msg = supabase.table("messages") \
                .select("meta") \
                .eq("id", message_id) \
                .execute()

            if msg.data and msg.data[0].get("meta", {}).get("status") == "completed":
                yield f"event: done\ndata: {json.dumps({'message_id': message_id})}\n\n"
                return

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"  # Nginx 버퍼링 비활성화
        }
    )
```

**SSE 이벤트 형식**:
```
event: chunk
data: {"seq": 0, "delta": "안녕하세요", "timestamp": "2025-01-30T12:00:00Z"}

event: chunk
data: {"seq": 1, "delta": " 고객님", "timestamp": "2025-01-30T12:00:01Z"}

event: done
data: {"message_id": 123}
```

#### 2.4 POST /chat/message/:id/finalize (Finalize Streaming)

**청크 병합 및 최종 저장**:
```python
@router.post("/message/{message_id}/finalize")
async def finalize_message(message_id: int, user: dict = Depends(get_current_user)):
    # 1. 청크 조회
    chunks = supabase.table("message_chunks") \
        .select("seq, delta") \
        .eq("message_id", message_id) \
        .order("seq", desc=False) \
        .execute()

    # 2. 청크 병합
    final_content = "".join([chunk["delta"] for chunk in chunks.data or []])

    # 3. messages.content 업데이트
    supabase.table("messages").update({
        "content": final_content,
        "meta": {
            "status": "completed",
            "chunk_count": len(chunks.data or [])
        }
    }).eq("id", message_id).execute()

    return {
        "ok": True,
        "message_id": message_id,
        "finalized": True,
        "chunk_count": len(chunks.data or [])
    }
```

### 3. Database Schema

#### 3.1 conversations (대화 세션)

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT,
    property_address TEXT,
    contract_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own conversations"
ON conversations FOR ALL
USING (auth.uid() = user_id);
```

#### 3.2 messages (메시지)

```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access messages in their conversations"
ON messages FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
);
```

#### 3.3 message_chunks (스트리밍 청크)

```sql
CREATE TABLE message_chunks (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,  -- 청크 순서
    delta TEXT NOT NULL,   -- 청크 내용
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, seq)  -- 중복 방지
);

-- 인덱스
CREATE INDEX idx_message_chunks_message_id ON message_chunks(message_id);
CREATE INDEX idx_message_chunks_seq ON message_chunks(message_id, seq);

-- RLS
ALTER TABLE message_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access chunks for their messages"
ON message_chunks FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM messages
        JOIN conversations ON conversations.id = messages.conversation_id
        WHERE messages.id = message_chunks.message_id
        AND conversations.user_id = auth.uid()
    )
);
```

## Data Flow

### User Message Flow (사용자 메시지 전송)

```
1. User types message
   ↓
2. ChatInterface.handleSubmit()
   ├─ Local state update: setMessages([...prev, userMessage])
   └─ chatStorage.addMessage(userMessage, syncToServer=true)
       ├─ IndexedDB: Save to 'messages' store
       └─ API call: POST /api/chat/message
           ├─ Idempotency check (client_message_id)
           ├─ Save to Supabase (messages table)
           └─ Return message_id
   ↓
3. chatStorage.subscribeToMessageStream(message_id)
   ├─ EventSource: GET /api/chat/stream/:message_id
   ├─ Receive 'chunk' events → updateStreamingMessage()
   └─ Receive 'done' event → finalizeMessage()
```

### AI Response Flow (AI 응답 스트리밍)

```
1. FastAPI receives user message
   ↓
2. LLM processes message (OpenAI GPT-4o-mini)
   ├─ Generate response chunks
   └─ Save to message_chunks table
   ↓
3. SSE polling loop (GET /stream/:message_id)
   ├─ Poll message_chunks every 1 second
   ├─ Send 'chunk' events to client
   └─ Send 'done' event when completed
   ↓
4. Client receives chunks
   ├─ updateStreamingMessage() → Update IndexedDB
   └─ ChatInterface updates UI (setMessages)
   ↓
5. Finalize (POST /message/:id/finalize)
   ├─ Merge all chunks → messages.content
   └─ Mark as completed (meta.status = "completed")
```

## Key Features

### 1. Idempotency (중복 방지)

**문제**: 네트워크 재시도 시 동일 메시지가 중복 저장될 수 있음

**해결**:
- **Client-side**: ULID 기반 `client_message_id` 생성
- **Server-side**: `messages.meta.client_message_id` 필드로 중복 체크
- **HTTP Header**: `X-Idempotency-Key` 헤더 지원

**예시**:
```typescript
// Frontend (chatStorage.ts)
const clientMessageId = this.generateULID(); // "01JSKF123ABC..."

await fetch('/api/chat/message', {
  headers: {
    'X-Idempotency-Key': clientMessageId,
  },
  body: JSON.stringify({
    conversation_id: convId,
    content: message.content,
    client_message_id: clientMessageId,
  }),
});
```

### 2. SSE Streaming (실시간 스트리밍)

**왜 SSE인가?**
- **단방향 통신**: 서버 → 클라이언트만 전송 (채팅에 최적)
- **HTTP 프로토콜**: WebSocket 대비 구현 간단, 방화벽 우회 용이
- **자동 재연결**: EventSource API가 자동 재연결 지원

**대안 비교**:
| 기술 | 장점 | 단점 | 적합성 |
|------|------|------|--------|
| SSE | 단순, HTTP, 자동 재연결 | 단방향만 가능 | ✅ 채팅 응답 |
| WebSocket | 양방향, 낮은 레이턴시 | 복잡, 방화벁 문제 | 게임, 실시간 협업 |
| Long Polling | 호환성 좋음 | 비효율적, 서버 부하 | 레거시 지원 |

### 3. Offline Support (오프라인 지원)

**IndexedDB 캐싱 전략**:
- 모든 메시지를 로컬에 저장
- 네트워크 연결 없이도 과거 대화 조회 가능
- 온라인 복구 시 자동 동기화 (`syncFromServer()`)

**동기화 시나리오**:
```
Case 1: 오프라인 → 온라인
  1. User types message (offline)
  2. Save to IndexedDB only
  3. Network reconnects
  4. syncMessageToServer() → Upload pending messages

Case 2: 새 기기 로그인
  1. User logs in on new device
  2. syncFromServer() → Download all conversations
  3. Save to IndexedDB
  4. User can browse past chats
```

### 4. Performance Optimization

**렌더링 최적화**:
- `React.memo()` for Message component
- Virtual scrolling for long conversations (TODO)

**네트워크 최적화**:
- Idempotency → 중복 요청 방지
- SSE → 효율적인 실시간 통신

**데이터베이스 최적화**:
- IndexedDB 인덱싱: `updatedAt`, `sessionId`, `timestamp`
- Supabase RLS: 불필요한 데이터 전송 방지

## Error Handling

### 1. Network Errors

**재시도 로직**:
```typescript
// chatStorage.ts
private async syncMessageToServer(message: Message): Promise<void> {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const response = await fetch('/api/chat/message', { /* ... */ });
      if (response.ok) return;

      attempt++;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    } catch (error) {
      attempt++;
      if (attempt >= MAX_RETRIES) {
        console.error('[ChatStorage] Max retries reached:', error);
        // TODO: Queue for later retry
      }
    }
  }
}
```

### 2. SSE Connection Errors

**자동 재연결**:
```typescript
eventSource.addEventListener('error', (error) => {
  console.error('[ChatStorage] SSE error:', error);
  eventSource.close();

  // EventSource 자동 재연결 (3초 대기)
  setTimeout(() => {
    this.subscribeToMessageStream(messageId);
  }, 3000);
});
```

### 3. Database Errors

**Graceful Degradation**:
```typescript
if (!this.db) {
  console.warn('[ChatStorage] IndexedDB not available, using memory only');
  // Fallback to in-memory storage
  this.sessions.set(id, session);
}
```

## Security Considerations

### 1. Authentication

**Supabase Auth + RLS**:
- 모든 API 요청에 JWT 토큰 필요
- Row Level Security로 사용자 데이터 격리

### 2. Data Encryption

**IndexedDB**:
- 브라우저 로컬 저장소 (유저별 격리)
- HTTPS 필수 (전송 중 암호화)

**Supabase**:
- 데이터베이스 암호화 (at rest)
- TLS 1.3 (전송 중 암호화)

### 3. Idempotency Key Security

**ULID 형식**:
- Timestamp (48 bits) + Random (80 bits)
- 충돌 확률: ~1e-24 (실질적으로 0)

## Testing Strategy

### 1. Unit Tests

```typescript
// chatStorage.test.ts
describe('ChatStorage', () => {
  it('should create session with conversationId', async () => {
    const sessionId = await chatStorage.createSession('test', 'conv-123');
    const session = await chatStorage.getCurrentSession();

    expect(session?.conversationId).toBe('conv-123');
    expect(session?.synced).toBe(true);
  });

  it('should prevent duplicate messages with same idempotency key', async () => {
    const message = { id: 'ulid-1', role: 'user', content: 'test' };

    await chatStorage.addMessage(message);
    const session1 = await chatStorage.getCurrentSession();

    await chatStorage.addMessage(message);
    const session2 = await chatStorage.getCurrentSession();

    expect(session1?.messages.length).toBe(session2?.messages.length);
  });
});
```

### 2. Integration Tests

```typescript
// chat.integration.test.ts
describe('Chat E2E Flow', () => {
  it('should complete full message flow', async () => {
    // 1. Init conversation
    const convId = await fetch('/api/chat/init', { method: 'POST' });

    // 2. Send message
    const { message_id } = await fetch('/api/chat/message', {
      body: JSON.stringify({
        conversation_id: convId,
        content: 'test',
      }),
    });

    // 3. Subscribe to stream
    const eventSource = new EventSource(`/api/chat/stream/${message_id}`);
    const chunks: string[] = [];

    eventSource.addEventListener('chunk', (event) => {
      const data = JSON.parse(event.data);
      chunks.push(data.delta);
    });

    await new Promise(resolve => {
      eventSource.addEventListener('done', resolve);
    });

    // 4. Verify finalized message
    const finalMessage = await fetch(`/api/chat/message/${message_id}`);
    expect(finalMessage.content).toBe(chunks.join(''));
  });
});
```

## Deployment

### 1. Environment Variables

```bash
# Frontend (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Backend (.env)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
OPENAI_API_KEY=sk-...
```

### 2. Database Migrations

```bash
# Supabase CLI
supabase db push

# Or manual SQL execution
psql -h db.your-project.supabase.co -U postgres < migrations/001_chat_tables.sql
```

### 3. Vercel Deployment (Frontend)

```bash
vercel --prod
```

### 4. Google Cloud Run (Backend)

```bash
cd services/ai
gcloud run deploy zipcheck-ai \
  --source . \
  --region asia-northeast3 \
  --allow-unauthenticated
```

## Future Improvements

### 1. Message Reactions

```typescript
// POST /api/chat/reactions
{
  "message_id": 123,
  "reaction": "👍"
}
```

### 2. File Attachments

```typescript
// POST /api/chat/attachments
// 1. Request signed URL
// 2. Upload to Supabase Storage
// 3. Save metadata to 'attachments' table
```

### 3. Read Receipts

```sql
CREATE TABLE message_reads (
    message_id INTEGER REFERENCES messages(id),
    user_id UUID REFERENCES auth.users(id),
    read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);
```

### 4. Virtual Scrolling (Performance)

```typescript
// react-window or react-virtualized
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={messages.length}
  itemSize={100}
>
  {({ index, style }) => (
    <div style={style}>
      <Message message={messages[index]} />
    </div>
  )}
</FixedSizeList>
```

## References

- [Server-Sent Events (SSE) Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [ULID Specification](https://github.com/ulid/spec)
- [FastAPI StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)

## Changelog

### 2025-01-30
- ✅ IndexedDB 기반 chatStorage 구현
- ✅ Idempotency 지원 (client_message_id + X-Idempotency-Key)
- ✅ SSE 스트리밍 엔드포인트 구현 (GET /stream/:message_id)
- ✅ 메시지 완료 엔드포인트 구현 (POST /message/:id/finalize)
- ✅ Supabase 동기화 기능 (syncFromServer)
- ✅ 아키텍처 문서 작성 (CHAT_ARCHITECTURE.md)