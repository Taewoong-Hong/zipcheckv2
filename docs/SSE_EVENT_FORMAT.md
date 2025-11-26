# SSE 이벤트 포맷 사양서 (Server-Sent Events Format Specification)

> **작성일**: 2025-01-29
> **버전**: 1.0.0
> **적용 엔드포인트**: `/analyze/stream/{case_id}`, `/chat/stream`

## 📋 개요

집체크 v2의 듀얼 LLM 스트리밍 시스템에서 사용하는 SSE (Server-Sent Events) 이벤트 포맷 표준입니다.

**핵심 원칙**:
- **통합성**: 모든 스트리밍 엔드포인트는 동일한 이벤트 포맷 사용
- **타입 안전성**: TypeScript 타입 정의로 컴파일 타임 검증
- **확장성**: 새로운 페이즈 및 이벤트 타입 추가 용이
- **디버깅**: 명확한 phase 구분과 진행 상황 추적

---

## 🔧 기본 구조

### SSE 메시지 포맷

모든 이벤트는 다음 형식으로 전송됩니다:

```
data: {JSON 객체}\n\n
```

**예시**:
```
data: {"step": 1, "message": "🚀 분석을 시작합니다...", "progress": 0.1}\n\n
```

### JSON 객체 공통 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `step` | `number` | ✅ | 이벤트 단계 (1~8 정수 또는 소수점) |
| `message` | `string` | ✅ | 사용자에게 표시할 진행 메시지 |
| `progress` | `number` | ✅ | 진행률 (0.0~1.0) |
| `phase` | `SSEPhase` | ❌ | 현재 처리 페이즈 (선택적) |
| `model` | `LLMModel` | ❌ | LLM 모델 이름 (선택적) |

---

## 📊 이벤트 페이즈 (Phase)

### 1. `start` - 시작 단계

분석 또는 채팅 세션 시작.

```json
{
  "step": 1,
  "phase": "start",
  "message": "🚀 분석을 시작합니다...",
  "progress": 0.1
}
```

### 2. `case_loading` - 케이스 데이터 조회

Supabase에서 케이스 정보 로딩.

```json
{
  "step": 2,
  "phase": "case_loading",
  "message": "✅ 케이스 조회 완료: 서울특별시 강남구...",
  "progress": 0.25,
  "address": "서울특별시 강남구 역삼동 123-45"
}
```

### 3. `registry_parsing` - 등기부 파싱

PDF 등기부 파싱 및 구조화.

```json
{
  "step": 3,
  "phase": "registry_parsing",
  "message": "✅ 등기부 파싱 완료\n   📍 주소: ...",
  "progress": 0.4,
  "registry_summary": {
    "property_address": "서울특별시 강남구 역삼동 123-45",
    "owner": {
      "name": "홍XX",
      "share_ratio": "1/1"
    },
    "mortgages": [
      {
        "creditor": "하나은행",
        "amount": 50000
      }
    ]
  }
}
```

### 4. `public_data` - 공공데이터 조회

법정동코드 및 실거래가 조회.

```json
{
  "step": 4,
  "phase": "public_data",
  "message": "✅ 법정동코드: 11680",
  "progress": 0.55,
  "lawd_cd": "11680"
}
```

```json
{
  "step": 4,
  "phase": "public_data",
  "message": "✅ 평균 실거래가: 75,000만원 (15건 분석)",
  "progress": 0.6,
  "avg_trade_price": 75000,
  "trade_count": 15
}
```

### 5. `risk_calculation` - 리스크 점수 계산

규칙 기반 리스크 분석 (LLM 없음).

```json
{
  "step": 5,
  "phase": "risk_calculation",
  "message": "✅ 리스크 분석 완료\n   📊 총점: 45.0점\n   🎯 위험 등급: 주의",
  "progress": 0.75,
  "risk_score": {
    "total_score": 45.0,
    "risk_level": "주의",
    "jeonse_ratio": 83.3,
    "mortgage_ratio": 25.0,
    "risk_factors": [
      "전세가율 83.3% (위험)",
      "근저당 비율 25.0% (보통)"
    ]
  }
}
```

### 6. `draft` - GPT-4o-mini 초안 생성

LLM 초안 스트리밍 (병렬 처리).

**스트리밍 중 (100자마다 업데이트)**:
```json
{
  "step": 6.1,
  "phase": "draft",
  "model": "gpt-4o-mini",
  "message": "📝 초안 생성 중... (300자)",
  "progress": 0.82,
  "partial_length": 300
}
```

**완료**:
```json
{
  "step": 6.1,
  "phase": "draft",
  "model": "gpt-4o-mini",
  "message": "✅ GPT-4o-mini 초안 완료 (1500자)",
  "progress": 0.84,
  "draft_length": 1500
}
```

### 7. `validation` - Claude Sonnet 검증

LLM 검증 스트리밍 (병렬 처리).

**시작**:
```json
{
  "step": 6.2,
  "phase": "validation",
  "message": "🔍 Claude Sonnet 검증 시작...",
  "progress": 0.85
}
```

**스트리밍 중 (100자마다 업데이트)**:
```json
{
  "step": 6.2,
  "phase": "validation",
  "model": "claude-3-5-sonnet-latest",
  "message": "🔍 검증 중... (400자)",
  "progress": 0.88,
  "partial_length": 400
}
```

**완료**:
```json
{
  "step": 6.2,
  "phase": "validation",
  "model": "claude-3-5-sonnet-latest",
  "message": "✅ claude-3-5-sonnet-latest 검증 완료 (1200자)",
  "progress": 0.90,
  "validation_length": 1200
}
```

**Fallback (Sonnet 실패 시 Haiku 사용)**:
```json
{
  "step": 6.2,
  "phase": "validation",
  "model": "claude-3-5-haiku-latest",
  "message": "✅ claude-3-5-haiku-latest 검증 완료 (1000자)",
  "progress": 0.90,
  "validation_length": 1000
}
```

### 8. `report_saving` - 리포트 저장

Supabase v2_reports 테이블에 저장.

```json
{
  "step": 7,
  "phase": "report_saving",
  "message": "💾 리포트 저장 중...",
  "progress": 0.95
}
```

### 9. `state_transition` - 상태 전환

케이스 상태 업데이트 (parse_enrich → report).

```json
{
  "step": 8,
  "phase": "state_transition",
  "message": "상태 전환: parse_enrich → report",
  "progress": 0.98,
  "current_state": "parse_enrich",
  "next_state": "report"
}
```

### 10. `completion` - 완료

분석 또는 채팅 완료.

```json
{
  "step": 8,
  "phase": "completion",
  "message": "✅ 분석 완료!",
  "progress": 1.0,
  "done": true,
  "report_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## ⚠️ 에러 이벤트

### 에러 객체 구조

```json
{
  "error": "에러 메시지"
}
```

**예시**:
```json
{
  "error": "케이스를 찾을 수 없거나 권한이 없습니다."
}
```

```json
{
  "error": "분석 중 오류 발생: Connection timeout"
}
```

---

## 🔄 완료 이벤트

### 완료 플래그

반드시 `done: true` 필드 포함.

```json
{
  "step": 8,
  "message": "✅ 분석 완료!",
  "progress": 1.0,
  "done": true,
  "report_id": "..."
}
```

**프론트엔드 처리**:
```typescript
if (event.done) {
  eventSource.close();
  // 리포트 로딩 또는 완료 처리
}
```

---

## 📱 프론트엔드 사용 예시

### TypeScript (React)

```typescript
import { createSSEStream, isSSEDone, isSSEError, SSEEvent } from '@/types/sse-events';

// SSE 스트림 생성
useEffect(() => {
  if (!isAnalyzing) return;

  const eventSource = createSSEStream(`/api/analysis/stream?caseId=${caseId}`, {
    onMessage: (event: SSEEvent) => {
      if (isSSEError(event)) {
        setError(event.error);
        return;
      }

      if (isSSEDone(event)) {
        console.log('분석 완료:', event.report_id);
        loadReport(event.report_id);
        return;
      }

      // 진행 상황 업데이트
      setStreamStep(event.step);
      setStreamProgress(event.progress);
      setStreamMessage(event.message);
    },
    onError: (error) => {
      console.error('SSE 연결 에러:', error);
      setError('연결이 끊어졌습니다. 다시 시도해주세요.');
    },
    maxRetries: 3,
    retryInterval: 2000
  });

  return () => eventSource.close();
}, [isAnalyzing, caseId]);
```

### 수동 EventSource 처리

```typescript
const eventSource = new EventSource(`/api/chat/stream`);

eventSource.onmessage = (msgEvent: MessageEvent) => {
  const event = JSON.parse(msgEvent.data) as SSEEvent;

  if ('error' in event) {
    console.error('에러:', event.error);
    eventSource.close();
    return;
  }

  if ('done' in event && event.done) {
    console.log('완료:', event.report_id);
    eventSource.close();
    return;
  }

  // 진행 상황 처리
  console.log(`[${event.phase}] ${event.message} (${event.progress * 100}%)`);
};

eventSource.onerror = (error) => {
  console.error('SSE 연결 에러:', error);
  eventSource.close();
};
```

---

## 🛡️ 타입 안전성

### 타입 가드 함수

```typescript
import { isSSEDone, isSSEError, isSSEDraft, isSSEValidation } from '@/types/sse-events';

if (isSSEDone(event)) {
  // event는 SSEDoneEvent 타입으로 좁혀짐
  console.log('리포트 ID:', event.report_id);
}

if (isSSEDraft(event)) {
  // event는 SSEDraftEvent 타입
  console.log('초안 길이:', event.draft_length);
}

if (isSSEValidation(event)) {
  // event는 SSEValidationEvent 타입
  console.log('검증 모델:', event.model);
}
```

---

## 📊 진행률 (Progress) 가이드

| Phase | Step | Progress 범위 | 설명 |
|-------|------|---------------|------|
| start | 1 | 0.10 | 시작 |
| case_loading | 2 | 0.20 ~ 0.25 | 케이스 조회 |
| registry_parsing | 3 | 0.30 ~ 0.40 | 등기부 파싱 |
| public_data | 4 | 0.50 ~ 0.65 | 공공데이터 조회 |
| risk_calculation | 5 | 0.70 ~ 0.75 | 리스크 분석 |
| draft | 6.1 | 0.78 ~ 0.84 | GPT 초안 |
| validation | 6.2 | 0.85 ~ 0.90 | Claude 검증 |
| report_saving | 7 | 0.95 | 리포트 저장 |
| state_transition | 8 | 0.98 | 상태 전환 |
| completion | 8 | 1.0 | 완료 |

---

## 🔍 디버깅 가이드

### 이벤트 로깅

```typescript
eventSource.onmessage = (msgEvent: MessageEvent) => {
  const event = parseSSEEvent(msgEvent.data);

  // 개발 환경에서만 상세 로깅
  if (process.env.NODE_ENV === 'development') {
    console.log('[SSE Event]', {
      step: event.step,
      phase: event.phase,
      model: event.model,
      progress: event.progress,
      message: event.message
    });
  }
};
```

### 재연결 로깅

```typescript
const createSSEStream = (url: string, options: SSEStreamOptions) => {
  let retryCount = 0;

  eventSource.onerror = (error) => {
    if (retryCount < maxRetries) {
      retryCount++;
      console.log(`[SSE] 재연결 시도 ${retryCount}/${maxRetries}...`);
    } else {
      console.error('[SSE] 최대 재연결 시도 초과');
    }
  };
};
```

---

## 📝 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0.0 | 2025-01-29 | 초기 버전 작성 (듀얼 LLM 스트리밍 통합) |

---

## 🔗 관련 파일

- **TypeScript 타입 정의**: `apps/web/types/sse-events.ts`
- **Backend 구현**: `services/ai/routes/analysis.py` (merge_dual_streams)
- **Backend 구현**: `services/ai/routes/chat.py` (POST /stream)
- **Frontend 사용 예시**: `apps/web/app/report/[caseId]/page.tsx`
