# 🔧 ZipCheck v2 백엔드 해결 과제

**작성일**: 2025-11-04
**담당**: 백엔드 개발팀
**우선순위**: P0 (Critical)

---

## 📋 해결 과제 요약

### 1️⃣ PDF 업로드 후 LLM이 읽지 못하는 현상 개선 (P0)
### 2️⃣ 주소 입력 시 채팅 2번 쳐야 입력되는 현상 개선 (P0)
### 3️⃣ Juso API 배포환경 송수신 처리 (P0)

---

## 🔍 1️⃣ PDF 업로드 후 LLM이 읽지 못하는 현상

### 📊 현상 분석
**문제**: 등기부 PDF 업로드 후, LLM이 내용을 파싱/분석하지 못함

**가능한 원인**:
1. **텍스트 추출 실패**: 이미지 기반 PDF인 경우 PyMuPDF로 텍스트 추출 불가
2. **OCR 미작동**: Gemini Vision OCR이 호출되지 않거나 실패
3. **파싱 정규식 실패**: 등기부 형식 변화로 정규식 패턴 매칭 실패
4. **Storage URL 문제**: Supabase Storage 서명 URL 만료 또는 권한 문제
5. **파일 크기 제한**: 대용량 PDF(20MB+) 처리 실패

### 🔬 진단 체크리스트
- [ ] `is_text_extractable_pdf()` 함수 로그 확인
- [ ] Gemini Vision OCR 호출 여부 확인 (이미지 PDF)
- [ ] `parse_with_regex()` 정규식 매칭 결과 확인
- [ ] Supabase Storage 서명 URL 유효성 확인
- [ ] Cloud Run 로그에서 파싱 에러 확인
- [ ] 테스트 PDF로 로컬 환경 재현 테스트

### ✅ 해결 방안

#### Phase 1: 로그 강화 및 에러 추적
```python
# services/ai/ingest/registry_parser.py

import logging
logger = logging.getLogger(__name__)

async def parse_registry_pdf(pdf_path: str) -> RegistryDocument:
    logger.info(f"🔍 [PDF Parser] 파싱 시작: {pdf_path}")

    # Step 1: PDF 타입 감지
    is_text_pdf, raw_text = is_text_extractable_pdf(pdf_path, min_chars=500)
    logger.info(f"📄 [PDF Type] Text PDF: {is_text_pdf}, Length: {len(raw_text)}자")

    # Step 2: 이미지 PDF면 Gemini Vision OCR
    if not is_text_pdf:
        logger.warning(f"🖼️ [Image PDF] Gemini Vision OCR 시작")
        raw_text = await ocr_with_gemini_vision(pdf_path)
        logger.info(f"✅ [OCR Complete] 추출 텍스트: {len(raw_text)}자")

        if not raw_text or len(raw_text) < 100:
            logger.error(f"❌ [OCR Failed] 텍스트 추출 실패")
            return RegistryDocument(raw_text=raw_text)

    # Step 3: 정규식 기반 파싱
    registry = parse_with_regex(raw_text)
    logger.info(f"✅ [Parser Complete] 주소={registry.property_address}, 근저당={len(registry.mortgages)}건")

    # Step 4: 파싱 검증
    if not registry.property_address and not registry.mortgages:
        logger.warning(f"⚠️ [Parser Warning] 주요 정보 누락 - 정규식 패턴 확인 필요")

    return registry
```

#### Phase 2: 파싱 개선
1. **다양한 등기부 형식 지원**:
   - 정규식 패턴 다양화 (지역별, 발급처별 형식 차이)
   - 테스트 케이스 추가 (서울/경기/지방 등기부)

2. **OCR 품질 개선**:
   - Gemini Vision API 파라미터 튜닝
   - 이미지 전처리 추가 (회전, 노이즈 제거)

3. **Fallback 전략**:
   - OCR 실패 시 사용자에게 재업로드 요청
   - 수동 입력 옵션 제공

#### Phase 3: 모니터링
```python
# services/ai/routes/registry.py

@router.post("/upload")
async def upload_registry(file: UploadFile, ...):
    # 파싱 성공률 추적
    try:
        registry = await parse_registry_pdf(tmp_path)

        # 파싱 품질 점수 계산
        quality_score = calculate_parsing_quality(registry)

        if quality_score < 0.5:
            logger.warning(f"⚠️ [Low Quality] 파싱 품질 낮음: {quality_score}")
            # Sentry 알림 전송

        return {"ok": True, "quality_score": quality_score}
    except Exception as e:
        logger.error(f"❌ [Parse Failed] {e}", exc_info=True)
        # Sentry에 에러 리포트
        raise
```

### 🎯 Action Items
- [ ] **로그 강화**: 파싱 각 단계별 상세 로그 추가
- [ ] **테스트 케이스**: 다양한 등기부 PDF로 테스트 (텍스트/이미지)
- [ ] **정규식 개선**: 지역별/형식별 패턴 추가
- [ ] **모니터링**: Sentry 통합 및 파싱 품질 대시보드
- [ ] **사용자 피드백**: 파싱 실패 시 재업로드 가이드

---

## 🔍 2️⃣ 주소 입력 시 채팅 2번 쳐야 입력되는 현상

### 📊 현상 분석
**문제**: 사용자가 주소를 입력하면 첫 번째 시도에서는 인식하지 못하고, 두 번째 시도에서 입력됨

**가능한 원인**:
1. **상태 업데이트 지연**: React 상태 업데이트가 비동기로 처리되어 첫 번째 입력이 반영 안 됨
2. **채팅 플로우 문제**: `/chat/init` 또는 `/chat/message` API 응답 지연
3. **WebSocket/SSE 타이밍**: 스트리밍 응답과 상태 업데이트 충돌
4. **Debounce/Throttle**: 입력 이벤트 처리 시 디바운스로 인한 지연
5. **백엔드 응답 지연**: FastAPI 응답 지연 또는 LLM 타임아웃

### 🔬 진단 체크리스트
- [ ] Chrome DevTools Network 탭에서 API 호출 순서 확인
- [ ] `/chat/init` 응답 시간 측정 (목표: <500ms)
- [ ] `/chat/message` 응답 시간 측정 (목표: <1s)
- [ ] React 컴포넌트 상태 업데이트 로그 확인
- [ ] FastAPI 로그에서 요청 처리 시간 확인

### ✅ 해결 방안

#### Phase 1: 프론트엔드 상태 관리 개선
**파일**: `apps/web/components/chat/ChatInterface.tsx`

```typescript
// Before (문제 발생 가능)
const handleSendMessage = async (message: string) => {
  // 상태 업데이트가 비동기로 처리되어 지연 발생
  setMessages([...messages, { role: 'user', content: message }]);

  // API 호출 시점에 상태가 아직 업데이트 안 됨
  const response = await fetch('/api/chat/message', { ... });
};

// After (개선)
const handleSendMessage = async (message: string) => {
  // 1. 즉시 상태 업데이트 (낙관적 업데이트)
  const newMessage = { role: 'user', content: message };
  setMessages(prev => [...prev, newMessage]);

  // 2. API 호출과 동시에 진행 (블로킹 없음)
  try {
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({ message, sessionId }),
    });

    // 3. 응답 스트리밍 처리
    const reader = response.body?.getReader();
    // ...
  } catch (error) {
    // 4. 실패 시 롤백
    setMessages(prev => prev.filter(m => m !== newMessage));
  }
};
```

#### Phase 2: 백엔드 응답 속도 개선
**파일**: `services/ai/routes/chat.py`

```python
@router.post("/message")
async def send_message(request: ChatMessageRequest, user: dict = Depends(get_current_user)):
    """채팅 메시지 처리 (스트리밍 응답)"""

    # 1. 즉시 응답 시작 (레이턴시 감소)
    async def stream_response():
        # 2. 메시지 저장 (비동기)
        asyncio.create_task(save_message_async(session_id, request.message))

        # 3. LLM 스트리밍 응답 (즉시 시작)
        async for chunk in llm_stream(request.message):
            yield f"data: {json.dumps({'content': chunk})}\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")
```

#### Phase 3: 주소 입력 전용 최적화
**파일**: `apps/web/components/AddressInput.tsx`

```typescript
const AddressInput = () => {
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  // 디바운스 제거 (주소 검색은 즉시 반응)
  const handleSearch = async (query: string) => {
    if (query.length < 2) return;

    // 즉시 API 호출
    const response = await fetch(`/api/address/search?keyword=${query}`);
    const data = await response.json();
    setSuggestions(data.results);
  };

  const handleSelect = (selectedAddress: string) => {
    // 즉시 상태 업데이트 + 부모 컴포넌트에 전달
    setAddress(selectedAddress);
    onAddressSelect?.(selectedAddress);

    // 채팅 메시지로 자동 전송 (1번만)
    sendChatMessage(`주소를 선택했습니다: ${selectedAddress}`);
  };
};
```

### 🎯 Action Items
- [ ] **상태 관리 개선**: 낙관적 업데이트 패턴 적용
- [ ] **API 응답 최적화**: `/chat/init` <500ms, `/chat/message` <1s
- [ ] **디바운스 제거**: 주소 입력은 즉시 반응 (100ms 이하)
- [ ] **E2E 테스트**: Playwright로 주소 입력 플로우 자동화 테스트
- [ ] **모니터링**: Vercel Analytics로 응답 시간 추적

---

## 🔍 3️⃣ Juso API 배포환경 송수신 처리

### 📊 현상 분석
**문제**: 도로명주소 API가 배포 환경에서 정상 작동하지 않음

**가능한 원인**:
1. **CORS 문제**: Vercel → 행정안전부 API 호출 시 CORS 차단
2. **API 키 인코딩**: 환경변수 또는 쿼리 파라미터 인코딩 문제
3. **IP 화이트리스트**: 공공데이터포털 API가 특정 IP만 허용
4. **프록시 필요**: 클라이언트 직접 호출 불가, 백엔드 프록시 필요
5. **Rate Limit**: 요청 제한 초과

### 🔬 진단 체크리스트
- [ ] Vercel 환경변수 `JUSO_API_KEY` 설정 확인
- [ ] API 호출 로그 확인 (성공/실패 응답)
- [ ] CORS 에러 여부 확인 (브라우저 콘솔)
- [ ] 공공데이터포털 API 사용량 확인
- [ ] IP 제한 여부 확인 (Vercel IP 대역)

### ✅ 해결 방안

#### Phase 1: 백엔드 프록시 구현 (권장)
**현재 문제**: 프론트엔드에서 직접 API 호출 → CORS 차단

**해결**: FastAPI 백엔드에서 프록시 처리

**파일**: `services/ai/routes/juso.py` (신규 생성)

```python
"""
도로명주소 API 프록시

행정안전부 도로명주소 API를 백엔드에서 프록시하여
CORS 문제 해결 및 API 키 보안 강화
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import httpx
from core.settings import settings

router = APIRouter(prefix="/juso", tags=["address"])


@router.get("/search")
async def search_juso(
    keyword: str = Query(..., min_length=2, description="검색어"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    count_per_page: int = Query(10, ge=1, le=100, description="페이지당 결과 수")
):
    """
    도로명주소 검색 (프록시)

    - 행정안전부 도로명주소 API 호출
    - CORS 문제 해결
    - API 키 숨김 처리
    """

    # API 키 확인
    if not settings.juso_api_key:
        raise HTTPException(500, "JUSO_API_KEY not configured")

    # 행정안전부 API 호출
    url = "https://www.juso.go.kr/addrlink/addrLinkApi.do"

    params = {
        "confmKey": settings.juso_api_key,
        "currentPage": str(page),
        "countPerPage": str(count_per_page),
        "keyword": keyword,
        "resultType": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                data=params,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                }
            )

            response.raise_for_status()
            data = response.json()

            # 에러 체크
            error_code = data.get("results", {}).get("common", {}).get("errorCode")
            error_message = data.get("results", {}).get("common", {}).get("errorMessage")

            if error_code != "0":
                raise HTTPException(400, f"Juso API Error: {error_message}")

            return data.get("results", {})

    except httpx.HTTPError as e:
        raise HTTPException(500, f"Juso API request failed: {str(e)}")
```

**파일**: `services/ai/app.py` (라우터 등록)

```python
from routes import juso

# 라우터 등록
app.include_router(juso.router)
```

#### Phase 2: 프론트엔드 API 호출 변경
**파일**: `apps/web/app/api/address/search/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

const AI_API_URL = process.env.AI_API_URL;

export async function GET(request: NextRequest) {
  if (!AI_API_URL) {
    return NextResponse.json(
      { error: 'AI_API_URL not configured' },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const keyword = searchParams.get('keyword');
  const page = searchParams.get('page') || '1';
  const countPerPage = searchParams.get('countPerPage') || '10';

  if (!keyword || keyword.length < 2) {
    return NextResponse.json(
      { error: '검색어는 최소 2자 이상이어야 합니다' },
      { status: 400 }
    );
  }

  try {
    // FastAPI 프록시로 호출 (CORS 문제 없음)
    const response = await fetch(
      `${AI_API_URL}/juso/search?keyword=${encodeURIComponent(keyword)}&page=${page}&countPerPage=${countPerPage}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Juso API proxy error:', error);
    return NextResponse.json(
      { error: '주소 검색 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

#### Phase 3: 환경변수 설정
**파일**: `services/ai/.env`

```bash
# 도로명주소 API 키
JUSO_API_KEY=U01TX0FVVEgyMDI1MDgwNzE2NTI0NzExNjAzOTI=
```

**Cloud Run Secret Manager** (프로덕션):

```bash
# Secret 생성
gcloud secrets create juso-api-key \
  --data-file=- <<< "U01TX0FVVEgyMDI1MDgwNzE2NTI0NzExNjAzOTI="

# Cloud Run에 Secret 연결
gcloud run services update zipcheck-ai \
  --region asia-northeast3 \
  --set-secrets "JUSO_API_KEY=juso-api-key:latest"
```

### 🎯 Action Items
- [ ] **백엔드 프록시**: `/juso/search` 엔드포인트 구현
- [ ] **프론트엔드 변경**: FastAPI 프록시 호출로 변경
- [ ] **환경변수**: Cloud Run Secret Manager 설정
- [ ] **테스트**: 로컬/프로덕션 환경 주소 검색 테스트
- [ ] **모니터링**: API 호출 성공률 추적

---

## 📊 우선순위 및 일정

| 과제 | 우선순위 | 예상 작업 시간 | 담당자 | 마감일 |
|------|---------|---------------|--------|--------|
| 1️⃣ PDF 파싱 개선 | P0 | 8시간 | 백엔드 | 2025-11-05 |
| 2️⃣ 주소 입력 개선 | P0 | 4시간 | 백엔드 + 프론트엔드 | 2025-11-05 |
| 3️⃣ Juso API 프록시 | P0 | 6시간 | 백엔드 | 2025-11-06 |

**총 예상 시간**: 18시간
**목표 완료일**: 2025-11-06

---

## 🧪 테스트 계획

### PDF 파싱 테스트
```bash
# 로컬 테스트
cd services/ai
python -m pytest tests/test_registry_parser.py -v

# 다양한 PDF로 테스트
curl -X POST http://localhost:8000/registry/upload \
  -F "file=@test_files/registry_text.pdf" \
  -F "case_id=test-case-1"

curl -X POST http://localhost:8000/registry/upload \
  -F "file=@test_files/registry_image.pdf" \
  -F "case_id=test-case-2"
```

### 주소 입력 테스트
```typescript
// Playwright E2E 테스트
import { test, expect } from '@playwright/test';

test('주소 입력 1번에 반영되는지 확인', async ({ page }) => {
  await page.goto('http://localhost:3000/chat');

  // 주소 검색
  await page.fill('input[placeholder="주소 검색"]', '서울특별시 강남구');

  // 첫 번째 결과 클릭
  await page.click('.address-suggestion:first-child');

  // 채팅 메시지에 즉시 반영되는지 확인
  const chatMessage = await page.locator('.chat-message:last-child');
  await expect(chatMessage).toContainText('서울특별시 강남구');
});
```

### Juso API 테스트
```bash
# FastAPI 프록시 테스트
curl "http://localhost:8000/juso/search?keyword=서울특별시+강남구"

# 프로덕션 테스트
curl "https://zipcheck-ai-ov5n6pt46a-du.a.run.app/juso/search?keyword=서울특별시+강남구"
```

---

## 📝 체크리스트

### 개발 전 확인사항
- [ ] 로컬 환경 테스트 완료
- [ ] 테스트 케이스 작성 완료
- [ ] 문서화 완료

### 개발 중 확인사항
- [ ] 코드 리뷰 완료
- [ ] 단위 테스트 통과
- [ ] E2E 테스트 통과

### 배포 전 확인사항
- [ ] 프로덕션 환경변수 설정
- [ ] Cloud Run Secret Manager 설정
- [ ] 성능 테스트 완료 (응답 시간 <1s)
- [ ] 에러 모니터링 설정 (Sentry)

### 배포 후 확인사항
- [ ] 프로덕션 동작 확인
- [ ] 모니터링 대시보드 확인
- [ ] 사용자 피드백 수집

---

## 🔗 관련 문서
- [CLAUDE.md](./CLAUDE.md) - 프로젝트 전체 가이드
- [FIX_LOCALHOST_REDIRECT.md](./FIX_LOCALHOST_REDIRECT.md) - 주소 검색 리다이렉션 가이드
- [docs/CHANGELOG_2025-01-29.md](./docs/CHANGELOG_2025-01-29.md) - 최근 변경사항

---

**작성자**: Claude (Backend Developer)
**최종 수정**: 2025-11-04
