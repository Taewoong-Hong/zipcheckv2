# 🧪 테스트 검증 가이드 (한국어)

## ✅ 구현 상태

이전 세션에서 수정한 모든 내용이 확인되었으며 테스트 준비가 완료되었습니다:

1. ✅ **보수적 주소 감지** - `analysisFlow.ts` (Lines 38-72)에 구현됨
2. ✅ **세션 반영 버그 수정** - `chatStorage.ts` (Lines 196-229), `ChatInterface.tsx` (Lines 697-708)에 구현됨
3. ✅ **개발 서버 실행 중** - 포트 3000 (PID 20672)

---

## 📋 테스트 시나리오

### **테스트 1: 일반적인 부동산 언급 (모달이 열리면 안 됨)**

**입력**: `강남 부동산을 좀 알아보고있는데말이야`

**예상 동작**:
- ❌ 주소 모달이 **열리면 안 됨**
- ✅ LLM이 일반 부동산 Q&A로 응답해야 함
- ✅ 콘솔에 표시: `[handleSubmit] ✅ Strategy 3: convId=...`

**이유**: 입력에 구체적인 주소 패턴이 없음 (도로명 번호, 행정구역+번호 없음)

**검증 단계**:
1. `http://localhost:3000` 접속
2. 브라우저 콘솔 열기 (F12)
3. 입력: `강남 부동산을 좀 알아보고있는데말이야`
4. Enter 키 입력
5. 모달이 열리지 않는지 확인
6. 콘솔 로그에서 Strategy 3 실행 확인

---

### **테스트 2: 구체적인 도로명 주소 (모달이 열려야 함)**

**입력**: `서울시 강남구 테헤란로 123`

**예상 동작**:
- ✅ 주소 모달이 **열려야 함**
- ✅ 모달에 주소 검색 인터페이스가 표시되어야 함
- ✅ 콘솔에 표시:
  - `[handleSubmit] ✅ Strategy 3: convId=...`
  - `[Strategy 1] Opening address modal for: 서울시 강남구 테헤란로 123`

**이유**: 입력이 도로명 패턴과 일치: `(로|길)\s*\d{1,4}` → "테헤란로 123"

**검증 단계**:
1. `http://localhost:3000` 접속
2. 브라우저 콘솔 열기 (F12)
3. 입력: `서울시 강남구 테헤란로 123`
4. Enter 키 입력
5. 주소 검색 모달이 나타나는지 확인
6. 콘솔 로그에서 Strategy 1 + 3 실행 확인

---

### **테스트 3: 행정구역 + 번호 (모달이 열려야 함)**

**입력**: `경기도 성남시 분당구 123`

**예상 동작**:
- ✅ 주소 모달이 **열려야 함**
- ✅ 패턴 일치: 행정구역(시, 구) + 번호 + 길이 ≥8자

**이유**: Tier 2 패턴 일치 - 행정구역 + 번호 조합

**검증 단계**:
1. 입력: `경기도 성남시 분당구 123`
2. 주소 모달이 열리는지 확인
3. 콘솔에서 Strategy 1 실행 확인

---

### **테스트 4: 건물 키워드 + 행정구역 (모달이 열려야 함)**

**입력**: `강남구 래미안아파트`

**예상 동작**:
- ✅ 주소 모달이 **열려야 함**
- ✅ 패턴 일치: 건물 키워드("아파트") + 행정구역("구")

**이유**: Tier 3 패턴 일치 - 건물 키워드와 행정구역이 함께 있음

**검증 단계**:
1. 입력: `강남구 래미안아파트`
2. 주소 모달이 열리는지 확인
3. 콘솔에서 Strategy 1 실행 확인

---

### **테스트 5: 건물 키워드만 (모달이 열리면 안 됨)**

**입력**: `강남 부동산` 또는 `강남 아파트`

**예상 동작**:
- ❌ 주소 모달이 **열리면 안 됨**
- ✅ LLM이 일반 Q&A로 응답해야 함

**이유**: 건물 키워드는 있지만 행정구역 패턴(시/도/군/구/읍/면/동/리)이 없음

**검증 단계**:
1. 입력: `강남 부동산`
2. 모달이 열리지 않는지 확인
3. LLM이 정상 응답하는지 확인

---

### **테스트 6: 첫 메시지 세션 동기화 (중요한 버그 수정)**

**입력**: 아무 메시지 (예: `안녕하세요`)

**예상 동작**:
- ✅ **첫 번째** 입력에서 메시지가 동기화되어야 함 (중복 입력 불필요)
- ✅ 콘솔에 **모든** 로그가 표시되어야 함:
  ```
  [handleSubmit] ✅ Strategy 3: convId= [UUID]
  [handleSubmit] 🔧 Updating chatStorage session with conversationId: [UUID]
  [ChatStorage] Session updated with conversationId: [UUID]
  ```
- ❌ 다음 로그가 **표시되면 안 됨**: `[ChatStorage] No conversation ID, skipping server sync`

**이유**: `updateSessionConversationId()` 메서드가 ChatInterface 상태와 chatStorage 세션 간의 간격을 메꿉니다

**검증 단계**:
1. **시크릿 창/사생활 보호 모드**로 `http://localhost:3000` 열기 (새 세션)
2. 브라우저 콘솔 열기 (F12)
3. 아무 메시지 입력: `안녕하세요`
4. Enter 키 입력
5. **즉시 콘솔 로그 확인** (위의 3개 로그 모두 있어야 함)
6. 메시지가 채팅에 **두 번 입력 없이** 나타나는지 확인
7. 페이지 새로고침 후 세션 목록에 메시지가 유지되는지 확인

---

## 🔍 콘솔 로그 참조

### 예상 로그 (성공)

```javascript
// Strategy 3: Conversation ID 준비됨
[handleSubmit] ✅ Strategy 3: convId= ed4c3e33-7385-4667-85c1-90f086ef33cd state conversationId= ed4c3e33-7385-4667-85c1-90f086ef33cd input= 안녕하세요

// 세션 업데이트 (첫 입력 시에만)
[handleSubmit] 🔧 Updating chatStorage session with conversationId: ed4c3e33-7385-4667-85c1-90f086ef33cd
[ChatStorage] Session updated with conversationId: ed4c3e33-7385-4667-85c1-90f086ef33cd

// Strategy 1: 주소 모달 트리거됨
[ChatInterface] Opening address search modal for initial address: 서울시 강남구 테헤란로 123
```

### 오류 로그 (표시되면 안 됨)

```javascript
// ❌ 첫 입력 시 이제 표시되면 안 됨
[ChatStorage] No conversation ID, skipping server sync

// ❌ 주소 감지가 너무 공격적임을 나타냄
[ChatInterface] Opening address search modal for initial address: 강남 부동산
```

---

## 📊 구현 세부사항

### 수정 1: 보수적 주소 감지

**파일**: `apps/web/lib/analysisFlow.ts`
**라인**: 38-72

**패턴 매칭 계층**:
1. **Tier 1** (도로명/지번 패턴): `/(로|길)\s*\d{1,4}/` 또는 `/\d{1,4}번지/`
2. **Tier 2** (행정구역 + 번호): 행정구역 + 번호 + 길이 ≥8자
3. **Tier 3** (건물 + 행정구역): 건물 키워드 + 행정구역 패턴
4. **기본값**: `false` 반환 (보수적 접근)

**테스트 케이스**:
| 입력 | 예상 | 일치된 계층 |
|-------|----------|--------------:|
| `강남 부동산을 좀 알아보고있는데말이야` | ❌ False | 없음 (구체적 패턴 없음) |
| `서울시 강남구 테헤란로 123` | ✅ True | Tier 1 (도로명 패턴) |
| `경기도 성남시 분당구 123` | ✅ True | Tier 2 (행정구역 + 번호) |
| `강남구 래미안아파트` | ✅ True | Tier 3 (건물 + 행정구역) |
| `강남 부동산` | ❌ False | 없음 (행정구역 없음) |
| `강남 아파트` | ❌ False | Tier 3는 행정구역 필요 |

---

### 수정 2: 세션 반영 버그

**변경된 파일**:
1. `apps/web/lib/chatStorage.ts` (Lines 196-229)
2. `apps/web/components/chat/ChatInterface.tsx` (Lines 697-708)

**근본 원인**:
- ChatInterface가 conversation ID를 생성하여 React 상태에 저장
- chatStorage 세션이 이 ID 없이 먼저 생성됨
- `syncMessageToServer()`가 `session?.conversationId`를 확인할 때 `undefined` 발견
- 첫 입력 시 메시지 동기화가 조용히 실패

**해결 방법**:
1. chatStorage에 `updateSessionConversationId()` 메서드 추가
2. conversation 생성 후 ChatInterface가 이 메서드를 호출
3. 메서드가 IndexedDB 트랜잭션을 사용하여 세션을 원자적으로 업데이트
4. `conversationId`, `synced = true`, `updatedAt` 필드 설정

**플로우 다이어그램**:
```
사용자 입력
    ↓
getOrCreateConversationId() → Conversation 생성 및 React 상태에 저장
    ↓
getCurrentSession() → 세션에 conversationId가 있는지 확인
    ↓
[없으면] updateSessionConversationId() → IndexedDB 세션 업데이트
    ↓
syncMessageToServer() → 이제 conversationId가 있어 동기화 성공 ✅
```

---

## 🚨 알려진 이슈 (이미 수정됨)

1. ✅ **수정됨**: 공격적인 주소 감지로 인한 거짓 양성
2. ✅ **수정됨**: 세션 동기화를 위해 첫 메시지가 중복 입력 필요
3. ✅ **수정됨**: Conversation 초기화 경쟁 조건 (단일 플라이트 패턴)
4. ✅ **수정됨**: tool_calls 중 메시지 손실 (임시 ID로 localStorage 저장)
5. ✅ **수정됨**: 채팅 메시지의 LaTeX 렌더링 (KaTeX 지원)

---

## 📝 테스트 체크리스트

- [ ] 테스트 1: 일반적인 주소 언급으로 모달이 트리거되지 않음
- [ ] 테스트 2: 구체적인 도로명 주소로 모달이 트리거됨
- [ ] 테스트 3: 행정구역 + 번호로 모달이 트리거됨
- [ ] 테스트 4: 건물 키워드 + 행정구역으로 모달이 트리거됨
- [ ] 테스트 5: 행정구역 없는 건물 키워드로 트리거되지 않음
- [ ] 테스트 6: 첫 메시지가 중복 입력 없이 동기화됨
- [ ] 예상 콘솔 로그가 모두 표시됨
- [ ] 오류 로그가 표시되지 않음
- [ ] 시크릿/사생활 보호 창에서 새 세션 테스트
- [ ] 페이지 새로고침 후 메시지 지속성 확인

---

## 🔧 문제 해결

### 이슈: 일반적인 언급에 모달이 열림
**확인**: `analysisFlow.ts` Lines 38-72 - 보수적 패턴이 적용되었는지 확인
**수정**: 세 가지 계층 모두 구체적인 패턴 필요 (도로명 번호, 행정구역 등)

### 이슈: 첫 메시지가 동기화되지 않음
**확인**: 브라우저 콘솔에서 `[ChatStorage] No conversation ID, skipping server sync` 찾기
**디버그**: 다음 로그가 표시되는지 확인:
1. `[handleSubmit] ✅ Strategy 3: convId=...`
2. `[handleSubmit] 🔧 Updating chatStorage session with conversationId:...`
3. `[ChatStorage] Session updated with conversationId:...`

**수정**: 누락된 경우 `ChatInterface.tsx` Lines 697-708에서 세션 업데이트 로직 확인

### 이슈: 콘솔 로그 누락
**확인**: 개발 서버가 최신 코드로 실행 중인지 확인
**수정**: `npm run dev` 실행 후 브라우저 하드 새로고침 (Ctrl+Shift+R)

---

## ✨ 테스트 후 다음 단계

1. **모든 테스트 통과 시**: 구현이 완료되어 프로덕션 준비 완료
2. **테스트 1 실패 시** (일반 언급에 모달 열림): `analysisFlow.ts` 패턴 검토
3. **테스트 6 실패 시** (중복 입력 필요): `chatStorage.ts` 세션 업데이트 메서드 검토
4. **콘솔 로그 누락 시**: 개발 서버가 최신 코드로 실행 중인지 확인

---

**테스트 환경**:
- 개발 서버: `http://localhost:3000` (포트 3000, PID 20672)
- 백엔드 API: 포트 8000 (전체 테스트에 필요한 경우)
- 브라우저: Chrome/Edge 권장 (DevTools F12)
- 테스트 모드: 새 세션 테스트를 위한 시크릿/사생활 보호 창

**마지막 업데이트**: 2025-01-17
**상태**: ✅ 사용자 테스트 준비 완료
