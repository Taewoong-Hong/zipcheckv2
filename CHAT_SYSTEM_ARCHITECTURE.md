# 📱 집체크 채팅 시스템 아키텍처

**작성일**: 2025-01-27
**버전**: 1.0.0

---

## 📋 개요

집체크 v2의 채팅 시스템은 **실시간 스트리밍 기반 AI 대화**를 제공합니다.

### 핵심 기능
- ✅ **실시간 스트리밍**: Server-Sent Events (SSE)로 AI 응답 실시간 표시
- ✅ **세션 관리**: 대화 세션 저장 및 관리 (in-memory)
- ✅ **파일 업로드**: PDF, 문서, 이미지 업로드 지원 (UI만 구현)
- ✅ **테스트 모드**: 전세 계약 검토 시뮬레이션
- ✅ **자동 스크롤**: 새 메시지 자동 스크롤
- ✅ **요청 취소**: AbortController로 진행 중 요청 취소

---

## 🏗️ 시스템 아키텍처

### 전체 데이터 플로우

```
[사용자 입력]
    ↓
[ChatInput.tsx] → 파일 업로드 UI + 입력창
    ↓
[ChatInterface.tsx] → 메시지 상태 관리 + SSE 스트리밍 처리
    ↓
[/api/chat (Next.js API Route)] → 프록시 + SSE 변환
    ↓
[Google Cloud Run - FastAPI /analyze] → LangChain + OpenAI
    ↓
[/api/chat] → 청크 단위로 SSE 전송 (50ms/단어)
    ↓
[ChatInterface.tsx] → 메시지 누적 업데이트
    ↓
[Message.tsx] → 타이핑 애니메이션 표시
    ↓
[chatStorage] → in-memory 저장
```

---

## 📦 파일 구조 및 역할

### 1️⃣ 타입 정의

**파일**: [apps/web/types/chat.ts](apps/web/types/chat.ts)

```typescript
export interface Message {
  id: string;                    // 고유 ID (Date.now() + random)
  role: 'user' | 'assistant' | 'system';
  content: string;               // 메시지 내용
  timestamp: Date;               // 생성 시간
  isStreaming?: boolean;         // 스트리밍 중 여부
  isError?: boolean;             // 에러 메시지 여부
}

export interface ChatSession {
  id: string;                    // 세션 ID (Date.now())
  title: string;                 // 세션 제목 (첫 메시지 30자)
  messages: Message[];           // 메시지 배열
  createdAt: Date;               // 생성 시간
  updatedAt: Date;               // 마지막 업데이트 시간
}

export interface ChatFile {
  id: string;                    // 파일 ID
  name: string;                  // 파일명
  type: string;                  // MIME 타입
  size: number;                  // 파일 크기 (bytes)
  url?: string;                  // 업로드 URL (추후 구현)
}
```

---

### 2️⃣ 세션 저장소

**파일**: [apps/web/lib/chatStorage.ts](apps/web/lib/chatStorage.ts)

**역할**: In-memory 채팅 세션 관리 (싱글톤 패턴)

**핵심 메서드**:

```typescript
class ChatStorage {
  private sessions: Map<string, ChatSession>;     // 모든 세션 저장
  private currentSessionId: string | null;        // 현재 활성 세션 ID

  // 새 세션 생성
  createSession(firstMessage?: string): string

  // 현재 세션 가져오기
  getCurrentSession(): ChatSession | null

  // 세션 변경
  setCurrentSession(id: string): boolean

  // 메시지 추가 (세션 없으면 자동 생성)
  addMessage(message: Message): void

  // 최근 10개 세션 가져오기
  getRecentSessions(): ChatSession[]

  // 세션 삭제
  deleteSession(id: string): boolean

  // 모든 세션 삭제
  clearAll(): void
}

export const chatStorage = new ChatStorage();
```

**특징**:
- 첫 메시지 기준으로 세션 제목 자동 생성 (30자 제한)
- 메시지 추가 시 자동으로 `updatedAt` 갱신
- 최근 세션은 `updatedAt` 기준 내림차순 정렬

⚠️ **제한사항**: In-memory 저장이므로 **페이지 새로고침 시 모든 대화 내역 삭제**

---

### 3️⃣ 테스트 시나리오

**파일**: [apps/web/lib/testScenario.ts](apps/web/lib/testScenario.ts)

**역할**: 전세 계약 검토 프로세스를 시뮬레이션하는 테스트 시나리오

**시나리오 구성**:
1. **등기부등본 분석**: 소유권, 근저당권, 전세권 확인
2. **건축물대장 검토**: 위반건축물 여부, 용적률, 건폐율
3. **시세 분석**: 실거래가, 전세가율, 경매 낙찰가
4. **임대인 재무상태**: 세금 체납, 다중채무 여부
5. **법적 리스크**: 소송, 압류, 가압류 확인
6. **종합 평가**: 리스크 등급 산정 및 권고사항

**스트리밍 시뮬레이션**:
```typescript
export async function simulateTestResponse(
  onChunk: (content: string) => void,
  onComplete: () => void
): Promise<void> {
  for (const message of TEST_SCENARIO_MESSAGES) {
    await new Promise(resolve => setTimeout(resolve, message.delay));

    // 한 글자씩 스트리밍 (8ms per character)
    const chars = message.content.split('');
    for (let i = 0; i < chars.length; i++) {
      onChunk(chars[i]);
      await new Promise(resolve => setTimeout(resolve, 8));
    }

    onChunk('\n\n');
  }
  onComplete();
}
```

**활성화 조건**: 사용자가 "test" 입력 시 자동 실행

---

### 4️⃣ 메인 채팅 컴포넌트

**파일**: [apps/web/components/chat/ChatInterface.tsx](apps/web/components/chat/ChatInterface.tsx:1-300)

**역할**: 채팅 UI 렌더링 + 메시지 상태 관리 + SSE 스트리밍 처리

#### 상태 관리

```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [isLoading, setIsLoading] = useState(false);
const abortControllerRef = useRef<AbortController | null>(null);
```

#### 메시지 전송 로직

```typescript
const handleSendMessage = async (content: string, files?: File[]) => {
  // 1. 사용자 메시지 추가
  const userMessage: Message = {
    id: `${Date.now()}-${Math.random()}`,
    role: 'user',
    content,
    timestamp: new Date(),
  };
  setMessages(prev => [...prev, userMessage]);
  chatStorage.addMessage(userMessage);

  // 2. 테스트 모드 확인
  if (content.toLowerCase() === 'test') {
    await handleTestMode();
    return;
  }

  // 3. AI 메시지 플레이스홀더 생성
  const aiMessageId = `${Date.now() + 1}-${Math.random()}`;
  const aiMessage: Message = {
    id: aiMessageId,
    role: 'assistant',
    content: '',
    timestamp: new Date(),
    isStreaming: true,
  };
  setMessages(prev => [...prev, aiMessage]);

  // 4. SSE 스트리밍 요청
  await streamResponse(aiMessageId, content);
};
```

#### SSE 스트리밍 처리

```typescript
const streamResponse = async (messageId: string, question: string) => {
  setIsLoading(true);
  abortControllerRef.current = new AbortController();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
      signal: abortControllerRef.current.signal,
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // SSE 형식 파싱: "data: {...}\n"
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr.trim()) {
            const data = JSON.parse(jsonStr);

            if (data.content) {
              accumulatedContent += data.content;
              // 메시지 실시간 업데이트
              setMessages(prev => prev.map(msg =>
                msg.id === messageId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              ));
            }

            if (data.done) {
              // 스트리밍 완료
              setMessages(prev => prev.map(msg =>
                msg.id === messageId
                  ? { ...msg, isStreaming: false }
                  : msg
              ));
              chatStorage.addMessage({
                id: messageId,
                role: 'assistant',
                content: accumulatedContent,
                timestamp: new Date(),
              });
              break;
            }
          }
        }
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request was cancelled');
    } else {
      console.error('Error streaming response:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? {
              ...msg,
              content: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
              isError: true,
              isStreaming: false,
            }
          : msg
      ));
    }
  } finally {
    setIsLoading(false);
    abortControllerRef.current = null;
  }
};
```

#### 테스트 모드 처리

```typescript
const handleTestMode = async () => {
  const aiMessageId = `${Date.now() + 1}-${Math.random()}`;
  const aiMessage: Message = {
    id: aiMessageId,
    role: 'assistant',
    content: '',
    timestamp: new Date(),
    isStreaming: true,
  };
  setMessages(prev => [...prev, aiMessage]);
  setIsLoading(true);

  await simulateTestResponse(
    (chunk: string) => {
      // 청크 누적
      setMessages(prev => prev.map(msg =>
        msg.id === aiMessageId
          ? { ...msg, content: msg.content + chunk }
          : msg
      ));
    },
    () => {
      // 완료
      setMessages(prev => prev.map(msg =>
        msg.id === aiMessageId
          ? { ...msg, isStreaming: false }
          : msg
      ));
      setIsLoading(false);
      chatStorage.addMessage({
        id: aiMessageId,
        role: 'assistant',
        content: messages.find(m => m.id === aiMessageId)?.content || '',
        timestamp: new Date(),
      });
    }
  );
};
```

#### 자동 스크롤

```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);
```

---

### 5️⃣ 입력 컴포넌트

**파일**: [apps/web/components/chat/ChatInput.tsx](apps/web/components/chat/ChatInput.tsx:1-150)

**역할**: 메시지 입력 + 파일 업로드 UI

#### 주요 기능

```typescript
interface ChatInputProps {
  onSendMessage: (message: string, files?: File[]) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 자동 높이 조절 (최대 200px)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  // 키보드 단축키
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter: 전송, Shift+Enter: 줄바꿈
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // 파일 업로드 (UI만 구현, 실제 업로드는 추후)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* 파일 미리보기 */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((file, index) => (
            <div key={index} className="flex items-center gap-2 px-3 py-1 bg-neutral-100 rounded">
              <Paperclip className="w-4 h-4" />
              <span className="text-sm">{file.name}</span>
              <button onClick={() => removeFile(index)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 입력 영역 */}
      <div className="flex items-end gap-2">
        {/* 업로드 버튼 */}
        <label className="cursor-pointer">
          <Upload className="w-5 h-5" />
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.hwp,.txt,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {/* 텍스트 입력 */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
          disabled={disabled}
          className="flex-1 resize-none rounded-lg px-4 py-3 max-h-[200px]"
        />

        {/* 전송 버튼 */}
        <button
          type="submit"
          disabled={disabled || (!message.trim() && files.length === 0)}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
}
```

**지원 파일 형식**:
- 문서: `.pdf`, `.doc`, `.docx`, `.hwp`, `.txt`
- 이미지: `.png`, `.jpg`, `.jpeg`

⚠️ **제한사항**: 파일 업로드 UI만 구현, 실제 업로드 로직은 미구현

---

### 6️⃣ 메시지 표시 컴포넌트

**파일**: [apps/web/components/chat/Message.tsx](apps/web/components/chat/Message.tsx:1-100)

**역할**: 개별 메시지 렌더링 + 타이핑 애니메이션

#### 주요 기능

```typescript
interface MessageProps {
  message: Message;
  onCopy?: (content: string) => void;
  onRegenerate?: (messageId: string) => void;
}

export default function Message({ message, onCopy, onRegenerate }: MessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-3 max-w-[80%] ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* 프로필 아이콘 */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-red-500' : 'bg-neutral-200'
        }`}>
          {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5" />}
        </div>

        {/* 메시지 내용 */}
        <div className={`rounded-lg px-4 py-3 ${
          isUser ? 'bg-red-500 text-white' : 'bg-white border border-neutral-200'
        }`}>
          {/* 타이핑 애니메이션 */}
          {message.isStreaming ? (
            <div className="flex items-center gap-2">
              <span className="animate-pulse">●</span>
              <span className="text-sm">응답 생성 중...</span>
            </div>
          ) : (
            <ReactMarkdown className="prose prose-sm max-w-none">
              {message.content}
            </ReactMarkdown>
          )}

          {/* 액션 버튼 (AI 메시지만) */}
          {!isUser && !message.isStreaming && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
              <button
                onClick={() => onCopy?.(message.content)}
                className="text-xs text-neutral-500 hover:text-neutral-700"
              >
                <Copy className="w-3 h-3" />
                복사
              </button>
              <button
                onClick={() => onRegenerate?.(message.id)}
                className="text-xs text-neutral-500 hover:text-neutral-700"
              >
                <RefreshCw className="w-3 h-3" />
                재생성
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**타이핑 애니메이션**:
- `isStreaming: true` → 펄스 애니메이션 표시
- SSE 청크 누적 시 실시간 텍스트 업데이트
- 완료 시 Markdown 렌더링

---

### 7️⃣ API 프록시

**파일**: [apps/web/app/api/chat/route.ts](apps/web/app/api/chat/route.ts:1-100)

**역할**: Next.js API Route → Google Cloud Run FastAPI 프록시 + SSE 변환

#### 엔드포인트: `POST /api/chat`

```typescript
import { NextRequest, NextResponse } from 'next/server';

const AI_API_URL = process.env.AI_API_URL ||
  'https://zipcheck-ai-871793445649.asia-northeast3.run.app';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 백엔드 AI 서비스 호출
    const response = await fetch(`${AI_API_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: body.messages[body.messages.length - 1].content,
        context: body.messages.slice(0, -1),
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API returned ${response.status}`);
    }

    const data = await response.json();
    const answer = data.answer || '';

    // SSE 형식으로 변환 (단어 단위로 청킹)
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const words = answer.split(/(\s+)/);  // 공백 기준 분리

        for (const word of words) {
          const chunk = encoder.encode(
            `data: ${JSON.stringify({ content: word })}\n\n`
          );
          controller.enqueue(chunk);
          await new Promise(resolve => setTimeout(resolve, 50));  // 50ms 딜레이
        }

        // 완료 신호
        const doneChunk = encoder.encode(
          `data: ${JSON.stringify({ done: true })}\n\n`
        );
        controller.enqueue(doneChunk);
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
```

#### Health Check 엔드포인트

```typescript
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

**SSE 형식**:
```
data: {"content":"안녕하세요"}

data: {"content":" 집체크"}

data: {"content":" AI입니다"}

data: {"done":true}

```

---

## 🔄 메시지 플로우 상세 분석

### 1️⃣ 일반 대화 플로우

```
[사용자] "강남구 아파트 전세 계약 검토해주세요"
    ↓
[ChatInput.tsx] handleSubmit()
    ↓
[ChatInterface.tsx] handleSendMessage()
    ├─ 1. 사용자 메시지 생성 (id: Date.now())
    ├─ 2. setMessages([...prev, userMessage])
    ├─ 3. chatStorage.addMessage(userMessage)
    └─ 4. AI 메시지 플레이스홀더 생성 (content: '', isStreaming: true)
    ↓
[ChatInterface.tsx] streamResponse()
    ├─ fetch('/api/chat', { body: { messages: [...] } })
    └─ signal: AbortController
    ↓
[/api/chat/route.ts] POST handler
    ├─ 백엔드 요청: fetch(`${AI_API_URL}/analyze`)
    ├─ 응답 받기: { answer: "..." }
    └─ SSE 스트림 생성: words.split() → 50ms 딜레이
    ↓
[ChatInterface.tsx] SSE 파싱
    ├─ reader.read() → 청크 읽기
    ├─ "data: {...}\n" 파싱
    ├─ accumulatedContent += data.content
    └─ setMessages(...누적 업데이트)
    ↓
[Message.tsx] 렌더링
    ├─ isStreaming: true → 펄스 애니메이션
    └─ content 실시간 업데이트
    ↓
[ChatInterface.tsx] 완료 처리
    ├─ data.done === true
    ├─ setMessages(...isStreaming: false)
    └─ chatStorage.addMessage(finalMessage)
```

### 2️⃣ 테스트 모드 플로우

```
[사용자] "test"
    ↓
[ChatInterface.tsx] handleSendMessage()
    ├─ if (content.toLowerCase() === 'test')
    └─ handleTestMode()
    ↓
[ChatInterface.tsx] handleTestMode()
    ├─ AI 메시지 플레이스홀더 생성
    └─ simulateTestResponse(onChunk, onComplete)
    ↓
[testScenario.ts] simulateTestResponse()
    ├─ for (message of TEST_SCENARIO_MESSAGES)
    ├─   await delay(message.delay)
    ├─   for (char of message.content)
    ├─     onChunk(char)  → 8ms 딜레이
    └─ onComplete()
    ↓
[ChatInterface.tsx] onChunk 콜백
    ├─ setMessages(prev => prev.map(msg =>
    │     msg.id === aiMessageId
    │       ? { ...msg, content: msg.content + chunk }
    │       : msg
    │   ))
    └─ 실시간 문자 누적
    ↓
[ChatInterface.tsx] onComplete 콜백
    ├─ setMessages(...isStreaming: false)
    └─ chatStorage.addMessage(finalMessage)
```

### 3️⃣ 요청 취소 플로우

```
[사용자] 전송 버튼 클릭 → AI 응답 스트리밍 중
    ↓
[사용자] 취소 버튼 클릭 또는 새 메시지 전송
    ↓
[ChatInterface.tsx] handleCancelRequest()
    ├─ abortControllerRef.current?.abort()
    └─ abortControllerRef.current = null
    ↓
[fetch() 내부] AbortError 발생
    ↓
[ChatInterface.tsx] catch (error)
    ├─ if (error.name === 'AbortError')
    └─ console.log('Request was cancelled')
    ↓
[UI] 스트리밍 중단, 입력창 활성화
```

---

## 🎯 핵심 기술 스택

### 프론트엔드
- **프레임워크**: Next.js 15 + React 19 + TypeScript
- **상태관리**: React useState + useRef
- **스트리밍**: ReadableStream + TextDecoder
- **마크다운**: react-markdown
- **아이콘**: lucide-react
- **스타일링**: Tailwind CSS

### 백엔드
- **API 프록시**: Next.js API Routes
- **AI 서비스**: Google Cloud Run (FastAPI + LangChain + OpenAI)
- **스트리밍**: Server-Sent Events (SSE)

---

## ⚠️ 현재 제한사항 및 개선 필요 사항

### 1️⃣ 세션 저장소
**문제**: In-memory 저장으로 페이지 새로고침 시 모든 대화 내역 삭제

**해결방안**:
```typescript
// Supabase v2_chat_sessions 테이블 설계
CREATE TABLE v2_chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  messages JSONB NOT NULL,  -- Message[] 배열
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

// RLS 정책
ALTER TABLE v2_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON v2_chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON v2_chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**구현 필요**:
- [ ] Supabase 테이블 마이그레이션
- [ ] `lib/chatStorage.ts` → Supabase 클라이언트로 교체
- [ ] CRUD API 엔드포인트 추가
- [ ] 낙관적 업데이트 (Optimistic UI)

### 2️⃣ 파일 업로드
**문제**: 파일 업로드 UI만 구현, 실제 업로드 로직 없음

**해결방안**:
```typescript
// Supabase Storage 버킷: chat-attachments
// RLS 정책: 사용자별 파일 접근 제어

// 파일 업로드 함수
async function uploadChatFile(file: File, sessionId: string): Promise<string> {
  const fileName = `${sessionId}/${Date.now()}-${file.name}`;

  const { data, error } = await supabase.storage
    .from('chat-attachments')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('chat-attachments')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
```

**구현 필요**:
- [ ] Supabase Storage 버킷 생성
- [ ] RLS 정책 설정
- [ ] 파일 업로드 API 엔드포인트 (`/api/chat/upload`)
- [ ] 백엔드에서 파일 처리 (PDF 파싱, OCR 등)
- [ ] ChatFile 타입에 `url` 필드 추가 및 메시지 전송 시 포함

### 3️⃣ 메시지 재생성
**문제**: "재생성" 버튼 UI만 있고 기능 없음

**해결방안**:
```typescript
// ChatInterface.tsx
const handleRegenerateMessage = async (messageId: string) => {
  // 1. 재생성할 메시지와 이전 사용자 메시지 찾기
  const messageIndex = messages.findIndex(m => m.id === messageId);
  const previousUserMessage = messages
    .slice(0, messageIndex)
    .reverse()
    .find(m => m.role === 'user');

  if (!previousUserMessage) return;

  // 2. 기존 AI 메시지 삭제
  setMessages(prev => prev.filter(m => m.id !== messageId));

  // 3. 새로운 응답 요청
  await streamResponse(messageId, previousUserMessage.content);
};
```

**구현 필요**:
- [ ] `handleRegenerateMessage` 함수 구현
- [ ] Message 컴포넌트에 `onRegenerate` prop 연결
- [ ] 로딩 상태 표시 (재생성 중...)

### 4️⃣ 컨텍스트 윈도우 관리
**문제**: 모든 메시지를 백엔드로 전송 (토큰 낭비)

**해결방안**:
```typescript
// 최근 N개 메시지만 전송 (예: 최근 10개)
const contextMessages = messages.slice(-10);

// 또는 토큰 수 기준 (tiktoken 사용)
import { encode } from 'gpt-tokenizer';

function getContextMessages(messages: Message[], maxTokens: number = 4000) {
  let totalTokens = 0;
  const contextMessages: Message[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = encode(messages[i].content).length;
    if (totalTokens + tokens > maxTokens) break;
    contextMessages.unshift(messages[i]);
    totalTokens += tokens;
  }

  return contextMessages;
}
```

**구현 필요**:
- [ ] `gpt-tokenizer` 패키지 설치
- [ ] 컨텍스트 윈도우 관리 함수 구현
- [ ] 환경변수로 최대 토큰 수 설정

### 5️⃣ 에러 핸들링 개선
**문제**: 네트워크 에러, 타임아웃 등 세밀한 에러 처리 부족

**해결방안**:
```typescript
// 에러 타입별 메시지
const ERROR_MESSAGES = {
  NETWORK_ERROR: '네트워크 연결을 확인해주세요.',
  TIMEOUT: '응답 시간이 초과되었습니다. 다시 시도해주세요.',
  SERVER_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  RATE_LIMIT: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  UNKNOWN: '알 수 없는 오류가 발생했습니다.',
};

// 에러 타입 감지 및 재시도 로직
async function streamResponseWithRetry(
  messageId: string,
  question: string,
  maxRetries: number = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await streamResponse(messageId, question);
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        handleFinalError(messageId, error);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}
```

**구현 필요**:
- [ ] 에러 타입별 메시지 정의
- [ ] 재시도 로직 구현 (Exponential backoff)
- [ ] 타임아웃 설정 (AbortController with timeout)
- [ ] 사용자 친화적 에러 UI (Toast notification)

### 6️⃣ 메시지 검색 기능
**문제**: 과거 대화 내역 검색 불가

**해결방안**:
```typescript
// Supabase Full-Text Search
CREATE INDEX idx_chat_messages_content ON v2_chat_sessions
  USING gin(to_tsvector('korean', messages::text));

// 검색 API
export async function searchChatHistory(
  userId: string,
  query: string
): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('v2_chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .textSearch('messages', query, {
      type: 'websearch',
      config: 'korean',
    })
    .order('updated_at', { ascending: false });

  return data || [];
}
```

**구현 필요**:
- [ ] Full-Text Search 인덱스 생성
- [ ] 검색 API 엔드포인트 (`/api/chat/search`)
- [ ] 검색 UI 컴포넌트
- [ ] 하이라이팅 기능

### 7️⃣ 실시간 타이핑 인디케이터
**문제**: 사용자가 입력 중일 때 상대방에게 표시 안 됨 (다중 사용자 채팅 시)

**해결방안**:
```typescript
// Supabase Realtime 구독
const channel = supabase.channel('chat-room')
  .on('broadcast', { event: 'typing' }, (payload) => {
    setTypingUsers(prev => [...prev, payload.userId]);
    setTimeout(() => {
      setTypingUsers(prev => prev.filter(id => id !== payload.userId));
    }, 3000);
  })
  .subscribe();

// 타이핑 이벤트 전송
const handleTyping = () => {
  channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId: currentUserId },
  });
};
```

**구현 필요**:
- [ ] Supabase Realtime 구독 설정
- [ ] 타이핑 이벤트 브로드캐스팅
- [ ] 타이핑 인디케이터 UI

---

## 📊 성능 최적화 권장사항

### 1️⃣ 메시지 가상화 (Virtualization)
**문제**: 메시지가 많아지면 DOM 렌더링 느려짐

**해결방안**:
```bash
npm install react-window
```

```typescript
import { FixedSizeList as List } from 'react-window';

<List
  height={600}
  itemCount={messages.length}
  itemSize={100}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <Message message={messages[index]} />
    </div>
  )}
</List>
```

### 2️⃣ 메시지 페이지네이션
**문제**: 초기 로드 시 모든 메시지 가져오기 (느림)

**해결방안**:
```typescript
// Infinite scroll with pagination
const loadMoreMessages = async () => {
  const { data, error } = await supabase
    .from('v2_chat_sessions')
    .select('messages')
    .eq('id', sessionId)
    .range(offset, offset + 50)  // 50개씩 로드
    .single();

  setMessages(prev => [...data.messages, ...prev]);
  setOffset(prev => prev + 50);
};
```

### 3️⃣ 낙관적 업데이트 (Optimistic UI)
**문제**: 네트워크 지연 시 사용자 경험 저하

**해결방안**:
```typescript
// 메시지 즉시 표시 → 백엔드 응답 대기
const handleSendMessage = async (content: string) => {
  const tempId = `temp-${Date.now()}`;
  const userMessage = {
    id: tempId,
    role: 'user',
    content,
    timestamp: new Date(),
  };

  // 즉시 UI 업데이트
  setMessages(prev => [...prev, userMessage]);

  try {
    // 백엔드 요청
    const response = await fetch('/api/chat/send', {
      method: 'POST',
      body: JSON.stringify(userMessage),
    });
    const { id: realId } = await response.json();

    // 실제 ID로 교체
    setMessages(prev => prev.map(m =>
      m.id === tempId ? { ...m, id: realId } : m
    ));
  } catch (error) {
    // 실패 시 메시지 제거
    setMessages(prev => prev.filter(m => m.id !== tempId));
  }
};
```

---

## 🧪 테스트 가이드

### 수동 테스트 시나리오

#### 1️⃣ 기본 대화 테스트
```
1. 브라우저에서 http://localhost:3000 접속
2. "안녕하세요" 입력 후 전송
3. AI 응답이 스트리밍으로 표시되는지 확인
4. 메시지가 chatStorage에 저장되는지 확인 (개발자 도구)
5. 자동 스크롤이 작동하는지 확인
```

#### 2️⃣ 테스트 모드 시나리오
```
1. 입력창에 "test" 입력 후 전송
2. 등기부등본 분석 시뮬레이션이 시작되는지 확인
3. 6단계 분석이 순차적으로 표시되는지 확인
4. 각 단계마다 지연 시간(delay)이 적용되는지 확인
5. 타이핑 애니메이션이 자연스러운지 확인
```

#### 3️⃣ 파일 업로드 UI 테스트
```
1. 업로드 버튼 클릭
2. PDF 파일 선택
3. 파일 미리보기가 표시되는지 확인
4. X 버튼으로 파일 제거 확인
5. 여러 파일 동시 업로드 테스트
```

#### 4️⃣ 요청 취소 테스트
```
1. 긴 응답을 생성하는 질문 입력
2. 스트리밍 중 취소 버튼 클릭
3. 스트리밍이 즉시 중단되는지 확인
4. 입력창이 다시 활성화되는지 확인
5. 콘솔에 "Request was cancelled" 로그 확인
```

#### 5️⃣ 키보드 단축키 테스트
```
1. Shift+Enter → 줄바꿈 확인
2. Enter → 메시지 전송 확인
3. 입력창 높이가 자동으로 조절되는지 확인 (최대 200px)
```

---

## 🔮 향후 개발 로드맵

### Phase 1: 기본 기능 안정화 (1-2주)
- [ ] Supabase 세션 저장소 마이그레이션
- [ ] 에러 핸들링 개선
- [ ] 메시지 재생성 기능 구현
- [ ] 컨텍스트 윈도우 관리

### Phase 2: 파일 업로드 (2-3주)
- [ ] Supabase Storage 설정
- [ ] 파일 업로드 API 구현
- [ ] PDF 파싱 및 벡터 임베딩
- [ ] 이미지 OCR 처리

### Phase 3: 고급 기능 (3-4주)
- [ ] 메시지 검색 기능
- [ ] 메시지 가상화 (react-window)
- [ ] 낙관적 업데이트
- [ ] 타이핑 인디케이터

### Phase 4: 성능 최적화 (1-2주)
- [ ] 메시지 페이지네이션
- [ ] 이미지/파일 레이지 로딩
- [ ] 응답 캐싱 (Redis)
- [ ] SSE 연결 풀링

---

## 📚 관련 문서

- [CLAUDE.md](CLAUDE.md) - 프로젝트 전체 가이드
- [ENCRYPTION_IMPLEMENTATION.md](ENCRYPTION_IMPLEMENTATION.md) - 데이터 암호화
- [PDF_VIEWER_GUIDE.md](PDF_VIEWER_GUIDE.md) - PDF 뷰어 시스템
- [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) - 보안 감사

---

**마지막 업데이트**: 2025-01-27
