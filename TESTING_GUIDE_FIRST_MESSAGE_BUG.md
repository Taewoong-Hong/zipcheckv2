# 첫 번째 메시지 세션 반영 버그 테스트 가이드

## 🎯 테스트 목적

3-part fix가 올바르게 동작하는지 확인:
1. 새 대화 생성 시 welcome 메시지가 표시되는지
2. 첫 번째 사용자 메시지가 UI에 표시되는지
3. 중복 메시지 로딩이 발생하지 않는지

## ✅ 사전 준비

### 서버 상태 확인
- **Next.js**: http://localhost:3000 (✅ 실행 중)
- **FastAPI**: http://0.0.0.0:8000 (✅ 실행 중)

### 구현된 Fix 요약

**파일**: `apps/web/components/chat/ChatInterface.tsx`

**Part 1 (Line 57)**:
```typescript
const justCreatedConversation = useRef(false);
```

**Part 2 (Lines 86-91)**:
```typescript
if (justCreatedConversation.current) {
  justCreatedConversation.current = false;
  console.log('[ChatInterface] Skipping message load - conversation just created, welcome messages already loaded');
  return;
}
```

**Part 3 (Line 209)**:
```typescript
setConversationId(id);
justCreatedConversation.current = true;
console.log('[getOrCreateConversationId] Conversation initialized:', id);
```

## 📝 테스트 시나리오

### Test Case 1: 새 대화에서 첫 메시지 전송

**Steps**:
1. 브라우저에서 http://localhost:3000 열기
2. 개발자 도구(F12) 열고 Console 탭 확인
3. 채팅 화면에서 아무 메시지나 입력 (예: "안녕하세요")
4. 전송 버튼 클릭

**Expected Results**:
✅ **UI 확인**:
- [ ] Welcome 메시지 2개가 표시됨:
  - "안녕하세요! 집체크 AI 입니다."
  - "부동산 계약 전 궁금한 점을 자유롭게 질문해주세요..."
- [ ] 사용자 메시지 "안녕하세요"가 표시됨
- [ ] AI 응답이 스트리밍으로 표시됨
- [ ] 메시지가 중복되지 않음

✅ **Console 로그 확인**:
```
[getOrCreateConversationId] Conversation initialized: <conversation_id>
[ChatInterface] Skipping message load - conversation just created, welcome messages already loaded
```

❌ **Failure Indicators**:
- Welcome 메시지가 표시되지 않음
- 사용자 메시지가 사라짐
- 중복 메시지가 표시됨
- Skip 로그가 없음

### Test Case 2: 기존 대화 다시 열기

**Steps**:
1. Test Case 1 완료 후 사이드바에서 다른 대화 클릭
2. 다시 Test Case 1에서 생성한 대화 클릭

**Expected Results**:
✅ **UI 확인**:
- [ ] Welcome 메시지 2개가 표시됨
- [ ] 첫 번째 메시지 "안녕하세요"가 표시됨
- [ ] AI 응답이 표시됨
- [ ] 메시지 순서가 올바름

✅ **Console 로그 확인**:
```
[ChatInterface] Loading messages for conversation: <conversation_id>
```
(Skip 로그가 없어야 함 - 기존 대화이므로)

### Test Case 3: 새 대화 → 메시지 → 새 대화 반복

**Steps**:
1. 홈 버튼 또는 새 대화 버튼 클릭
2. 메시지 입력 및 전송
3. Step 1-2 반복 (3회)

**Expected Results**:
✅ **모든 대화에서**:
- [ ] Welcome 메시지 표시
- [ ] 사용자 메시지 표시
- [ ] 중복 없음
- [ ] Skip 로그 정상 출력

## 🐛 버그 발생 시 디버깅

### Console 로그 체크리스트

**정상 플로우**:
```
1. [getOrCreateConversationId] Conversation initialized: <id>
2. [ChatInterface] Skipping message load - conversation just created, welcome messages already loaded
3. [sendMessage] Starting...
4. [API Response] Message saved
5. [Streaming] AI response...
```

**비정상 플로우 (Skip 로그 없음)**:
```
1. [getOrCreateConversationId] Conversation initialized: <id>
2. [ChatInterface] Loading messages for conversation: <id>  ⚠️ 문제!
3. [메시지가 덮어씌워짐]
```

### 네트워크 탭 체크

**Fetch/XHR 확인**:
1. `POST /api/chat/init` - 대화 생성
2. `POST /api/chat` - 메시지 전송
3. `GET /api/conversations/<id>/messages` - 메시지 로드 (⚠️ 새 대화에서 호출되면 안 됨!)

### React DevTools 체크

**Component State**:
- `ChatInterface.conversationId`: 설정됨
- `ChatInterface.messages`: Welcome 메시지 + 사용자 메시지
- `justCreatedConversation.current`: `false` (skip 후)

## 📊 테스트 결과 기록

### Test Case 1: 새 대화 첫 메시지
- [ ] PASS
- [ ] FAIL (이유: _________________)

### Test Case 2: 기존 대화 다시 열기
- [ ] PASS
- [ ] FAIL (이유: _________________)

### Test Case 3: 반복 테스트
- [ ] PASS
- [ ] FAIL (이유: _________________)

## 🔧 추가 검증 포인트

### Database 확인 (선택)

**Supabase Dashboard**:
1. `conversations` 테이블 확인
   - `title`: 첫 메시지 내용으로 설정됨
   - `message_count`: 3 (welcome 2개 + 사용자 1개 + AI 1개)

2. `messages` 테이블 확인
   - 메시지 순서: welcome1 → welcome2 → user → assistant
   - `client_message_id`: 중복 없음

### Performance 확인

**메모리 누수 체크**:
- 새 대화 반복 생성 (10회)
- Chrome DevTools Memory 탭에서 Heap snapshot
- 메모리 증가가 선형적인지 확인

## ✅ 최종 체크리스트

테스트 완료 후 확인:
- [ ] 모든 Test Case PASS
- [ ] Console 에러 없음
- [ ] 네트워크 에러 없음
- [ ] UI 렌더링 정상
- [ ] Database 데이터 정상
- [ ] 메모리 누수 없음

---

## 📝 테스트 완료 후

테스트 결과를 다음 형식으로 보고:

```
## 테스트 결과 요약

**일시**: YYYY-MM-DD HH:MM
**테스터**: [이름]
**브라우저**: Chrome/Edge/Firefox + 버전

### 결과
- Test Case 1: ✅ PASS / ❌ FAIL
- Test Case 2: ✅ PASS / ❌ FAIL
- Test Case 3: ✅ PASS / ❌ FAIL

### 발견된 이슈
[이슈 설명]

### 스크린샷
[필요시 첨부]
```

---

**마지막 업데이트**: 2025-11-27
**관련 세션**: Session 8-10
**구현 파일**: `apps/web/components/chat/ChatInterface.tsx`
