# 🚀 집체크 향후 개선 사항

## 📋 Phase 2: 자연어 주소 처리 (전략 2 적용)

### 배경
현재는 정규식 기반 주소 감지로 명확한 주소 입력만 처리합니다.
향후 더 자연스러운 대화형 인터페이스를 위해 LLM 기반 의도 파악이 필요할 수 있습니다.

### 필요한 시나리오

#### 1️⃣ 구체적 주소 없는 질문
```
사용자: "우리 동네 전세가율 좀 알려줘"
→ LLM이 "주소가 필요합니다" 판단 → 주소 모달 열기

사용자: "강남에서 좋은 아파트 찾아줘"
→ LLM이 검색 의도 파악 → 주소 검색 모달 열기
```

#### 2️⃣ 문맥 기반 주소 참조
```
사용자: "우리 집 계약 다시 보여줘"
→ LLM이 기존 케이스 존재 확인 → 모달 안 열고 리포트 표시

사용자: "저번에 본 아파트 전세 괜찮아?"
→ LLM이 대화 히스토리에서 주소 찾기 → 기존 분석 결과 표시
```

#### 3️⃣ 애매한 입력 처리
```
사용자: "서울에서 살 집 찾아줘"
→ LLM이 "주소 모달 필요" 판단

사용자: "전세가율이 뭐야?"
→ LLM이 "일반 질문" 판단 → 모달 안 열고 답변
```

### 구현 방법: 전략 2 (LLM + Fallback)

```typescript
// ChatInterface.tsx handleSubmit 수정

let openedByLLM = false;

try {
  // LLM 호출
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: convId,
      content,
      // LLM에게 주소 모달 필요 여부 판단 요청
      detect_address_intent: true,
    }),
  });

  const result = await response.json();

  // LLM 응답에서 tool_call 확인
  if (result.tool_calls?.some(tc => tc.function.name === 'search_address')) {
    openedByLLM = true;
    // LLM이 주소 모달 필요하다고 판단
    openAddressModal();
  }
} catch (error) {
  console.error('LLM 호출 실패:', error);
}

// Fallback: LLM 실패 시 프론트엔드가 강제로 판단
if (!openedByLLM && currentState === 'init' && isAddressInput(content)) {
  console.warn('[Fallback] LLM이 주소 모달을 열지 않아 프론트엔드가 강제 실행');
  openAddressModal();
}
```

### 장점
- 🧠 **자연스러운 대화**: "우리 동네 전세가율" 같은 자연어 처리
- 🔄 **문맥 인식**: 대화 히스토리 기반 주소 참조
- 🛡️ **안정성**: LLM 실패 시 fallback으로 정규식 감지

### 단점
- 💰 **비용 증가**: 모든 입력마다 LLM 호출
- ⏱️ **지연 시간**: 1~3초 LLM 응답 대기
- 🐛 **복잡도**: LLM vs 프론트엔드 판단 충돌 가능성

### 우선순위
- **Priority**: P2 (Phase 2)
- **Trigger**: 사용자 피드백에서 자연어 주소 입력 요구 증가 시
- **Estimated Effort**: 3~5일
  - LLM 프롬프트 튜닝: 1일
  - 프론트엔드 fallback 로직: 1일
  - 테스트 및 디버깅: 2~3일

### 관련 파일
- `apps/web/components/chat/ChatInterface.tsx` - handleSubmit 수정
- `apps/web/app/api/chat/route.ts` - detect_address_intent 파라미터 추가
- `services/ai/routes/chat_orchestrator.py` - LLM 의도 파악 로직

---

## 📝 기타 향후 개선 사항

### UX 개선
- [ ] 주소 자동완성 최적화 (카카오 API → VWorld API 전환 검토)
- [ ] 분석 진행 상황 실시간 표시 (WebSocket)
- [ ] 모바일 반응형 개선

### 성능 최적화
- [ ] LLM 응답 캐싱 (동일 질문 재요청 방지)
- [ ] 등기부 파싱 결과 캐싱 (Redis)
- [ ] 이미지 최적화 (Next.js Image 컴포넌트)

### 보안 강화
- [ ] Rate limiting (DDoS 방어)
- [ ] API 키 회전 자동화
- [ ] 등기부 민감정보 마스킹 강화

---

**Last Updated**: 2025-01-17
**Maintainer**: Development Team
