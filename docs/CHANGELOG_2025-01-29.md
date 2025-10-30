# 개발 일지 - 2025년 1월 29일

## 📋 작업 요약

채팅 기능 500/401 에러 완전 해결 및 환경변수 아키텍처 개선

---

## 🔧 주요 해결 과제

### 1. SUPABASE_ANON_KEY 개행 문자 이슈

**문제점**:
```python
ValueError: Invalid header value b'eyJhbGc...NJhY\n'
```
- Google Secret Manager에 저장된 `SUPABASE_ANON_KEY` 값에 개행 문자(`\n`) 포함
- HTTP 헤더 검증 실패로 Supabase Auth API 호출 불가

**해결 방법**:
```bash
# 개행 없는 새 버전 생성
echo -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." | \
  gcloud secrets versions add supabase-anon-key --data-file=-

# 결과: version 2 생성
```

**배포**:
- Cloud Run 리비전: `zipcheck-ai-00051-8hb`
- Secret Manager 버전: `supabase-anon-key:latest` (version 2)

---

### 2. SUPABASE_SERVICE_ROLE_KEY 누락

**문제점**:
```
채팅 초기화 오류: SUPABASE_SERVICE_ROLE_KEY environment variable is required
```
- FastAPI `/chat/init` 엔드포인트에서 필수 환경변수 누락
- Supabase 데이터베이스 작업 불가

**해결 방법**:
```bash
# 1. IAM 권한 부여 (이미 존재하는 secret)
gcloud secrets add-iam-policy-binding supabase-service-role-key \
  --member="serviceAccount:871793445649-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 2. Cloud Run 배포 시 환경변수 추가
gcloud run deploy zipcheck-ai \
  --source services/ai \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars "APP_ENV=production,LOG_LEVEL=INFO" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest,\
DATABASE_URL=supabase-database-url:latest,\
JWT_SECRET=supabase-jwt-secret:latest,\
SUPABASE_ANON_KEY=supabase-anon-key:latest,\
SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,\
VWORLD_API_KEY=vworld-api-key-production:latest"
```

**배포**:
- Cloud Run 리비전: `zipcheck-ai-00052-p2n`
- 환경변수: 6개 Secret 정상 연결

---

### 3. `/analyze` 엔드포인트 403 Forbidden 에러

**문제점**:
```
Chat API error: Error: 분석 실패: 403
```
- `/chat/init` ✅ → 메시지 저장 ✅ → `/analyze` ❌ (403)
- Authorization 헤더 누락으로 인증 실패

**Cloud Run 로그**:
```
INFO:     169.254.169.126:9188 - "POST /analyze HTTP/1.1" 403 Forbidden
```

**해결 방법**:

**파일**: `apps/web/app/api/chat/route.ts`

**변경 전** (Lines 50-59):
```typescript
// 2. LLM 분석 (기존 /analyze 엔드포인트)
const analyzeResponse = await fetch(`${AI_API_URL}/analyze`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    question: content,
  }),
});
```

**변경 후** (Lines 50-60):
```typescript
// 2. LLM 분석 (기존 /analyze 엔드포인트)
const analyzeResponse = await fetch(`${AI_API_URL}/analyze`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,  // ← 추가
  },
  body: JSON.stringify({
    question: content,
  }),
});
```

**결과**:
- `/analyze` 엔드포인트 정상 작동 (200 OK)
- 채팅 전체 플로우 완전 작동 확인

---

### 4. 하드코딩된 환경변수 Fallback 제거

**문제점**:
- 5개 파일에 하드코딩된 Cloud Run URL 또는 localhost:8000 fallback 존재
- `.env.local` 변경만으로 로컬/프로덕션 환경 전환 불가
- 디버깅 어려움 및 운영 리스크

**제거된 Fallback 패턴**:
```typescript
// Bad: 하드코딩된 fallback
const AI_API_URL = process.env.AI_API_URL || 'https://zipcheck-ai-ov5n6pt46a-du.a.run.app';
const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000';

// Good: 명시적 에러 가드
const AI_API_URL = process.env.AI_API_URL;
if (!AI_API_URL) {
  throw new Error('AI_API_URL 환경변수가 설정되어 있지 않습니다');
}
```

**수정된 파일**:

#### 1. `apps/web/app/api/chat/route.ts`
**변경 위치**: Lines 5-9
```typescript
const AI_API_URL = process.env.AI_API_URL;

if (!AI_API_URL) {
  throw new Error('AI_API_URL 환경변수가 설정되어 있지 않습니다');
}
```

#### 2. `apps/web/app/api/chat/sessions/route.ts`
**변경 위치**: Lines 7-11
```typescript
const AI_API_URL = process.env.AI_API_URL;

if (!AI_API_URL) {
  throw new Error('AI_API_URL 환경변수가 설정되어 있지 않습니다');
}
```

#### 3. `apps/web/app/api/ai/[...path]/route.ts`
**변경 위치**: Lines 3-7
```typescript
const AI_API_URL = process.env.AI_API_URL;

if (!AI_API_URL) {
  throw new Error('AI_API_URL 환경변수가 설정되어 있지 않습니다');
}
```

#### 4. `apps/web/app/api/report/[caseId]/route.ts`
**변경 위치**: Lines 23-30
```typescript
const backendUrl = process.env.NEXT_PUBLIC_AI_API_URL;

if (!backendUrl) {
  return NextResponse.json(
    { error: 'NEXT_PUBLIC_AI_API_URL 환경변수가 설정되어 있지 않습니다' },
    { status: 500 }
  );
}
```

#### 5. `apps/web/lib/api/client.ts`
**변경 위치**: Lines 1-5
```typescript
const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL;

if (!AI_API_URL) {
  throw new Error('NEXT_PUBLIC_AI_API_URL 환경변수가 설정되어 있지 않습니다');
}
```

**개선 효과**:
- ✅ `.env.local` 단일 진실 공급원(Single Source of Truth)
- ✅ 환경 전환 시 파일 수정 불필요
- ✅ 누락된 환경변수 즉시 감지 (Fail-Fast)
- ✅ 명확한 에러 메시지로 디버깅 용이

---

## 🏗️ 아키텍처 개선

### 환경변수 전략

**Before (문제점)**:
```typescript
// 5개 파일에 분산된 하드코딩
apps/web/app/api/chat/route.ts → 'https://zipcheck-ai-ov5n6pt46a-du.a.run.app'
apps/web/app/api/chat/sessions/route.ts → 'https://zipcheck-ai-ov5n6pt46a-du.a.run.app'
apps/web/app/api/ai/[...path]/route.ts → 'http://localhost:8000'
apps/web/app/api/report/[caseId]/route.ts → 'http://localhost:8000'
apps/web/lib/api/client.ts → 'http://localhost:8000'
```

**After (개선)**:
```env
# apps/web/.env.local (단일 설정)
AI_API_URL=https://zipcheck-ai-871793445649.asia-northeast3.run.app
NEXT_PUBLIC_AI_API_URL=https://zipcheck-ai-871793445649.asia-northeast3.run.app

# 로컬 개발 시 변경
# AI_API_URL=http://localhost:8000
# NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

### Fail-Fast 원칙

**코드 레벨 검증**:
```typescript
// 모듈 로드 시점에 검증
const AI_API_URL = process.env.AI_API_URL;
if (!AI_API_URL) {
  throw new Error('AI_API_URL 환경변수가 설정되어 있지 않습니다');
}
// → 런타임 전에 에러 발생, 디버깅 시간 단축
```

**런타임 검증**:
```typescript
// API 호출 시점에 검증
if (!backendUrl) {
  return NextResponse.json(
    { error: 'NEXT_PUBLIC_AI_API_URL 환경변수가 설정되어 있지 않습니다' },
    { status: 500 }
  );
}
// → 사용자에게 명확한 에러 메시지
```

---

## 🔐 Supabase SSR 통합 (이전 세션 작업)

### 주요 개선 사항

1. **쿠키 기반 세션 관리**
   - `createServerClient` 사용
   - Next.js 15 async cookies() 호환

2. **에러 핸들링 개선**
   - 500 에러 → 401/404 등 명확한 상태 코드
   - 구조화된 에러 타입 (NO_SESSION, INVALID_TOKEN, BACKEND_ERROR)

3. **Next.js 15 호환성**
   - `await cookies()` 패턴 적용
   - Promise-based params 지원

**관련 파일**:
- `apps/web/app/api/chat/init/route.ts`
- `apps/web/app/auth/callback/route.ts`
- `apps/web/lib/supabase.ts`

---

## 📊 최종 결과

### 채팅 플로우 검증

```
✅ 1. /chat/init (200 OK)
   - Supabase 세션 확인
   - 대화 세션 생성

✅ 2. 메시지 저장
   - v2_messages 테이블 INSERT
   - 사용자 메시지 저장 완료

✅ 3. /analyze (200 OK)
   - Authorization 헤더 전달
   - LLM 분석 요청

✅ 4. 응답 스트리밍
   - AI 응답 실시간 표시
   - 메시지 저장
```

### Cloud Run 배포 상태

**현재 리비전**: `zipcheck-ai-00052-p2n`

**환경변수** (6개 Secret):
```yaml
OPENAI_API_KEY: openai-api-key:latest
DATABASE_URL: supabase-database-url:latest
JWT_SECRET: supabase-jwt-secret:latest
SUPABASE_ANON_KEY: supabase-anon-key:latest (version 2, 개행 제거)
SUPABASE_SERVICE_ROLE_KEY: supabase-service-role-key:latest
VWORLD_API_KEY: vworld-api-key-production:latest
```

**IAM 권한**:
- Service Account: `871793445649-compute@developer.gserviceaccount.com`
- Role: `roles/secretmanager.secretAccessor`

---

## 📝 Git 커밋 기록

**커밋 해시**: `d3201b8`

**커밋 메시지**:
```
fix: Remove hardcoded environment variable fallbacks and add /analyze auth header

환경변수 fallback 제거 및 인증 개선:
- 모든 하드코딩된 환경변수 fallback URL 제거 (5개 파일)
- .env.local만으로 로컬/프로덕션 환경 전환 가능
- /analyze 엔드포인트에 Authorization 헤더 추가 (403 에러 해결)
- 환경변수 누락 시 명확한 에러 메시지 표시
```

**수정된 파일** (8개):
1. `apps/web/app/api/chat/route.ts`
2. `apps/web/app/api/chat/sessions/route.ts`
3. `apps/web/app/api/ai/[...path]/route.ts`
4. `apps/web/app/api/report/[caseId]/route.ts`
5. `apps/web/lib/api/client.ts`
6. `apps/web/app/api/chat/init/route.ts`
7. `apps/web/app/auth/callback/route.ts`
8. `apps/web/lib/supabase.ts`

---

## 🎯 핵심 성과

### 1. 완전한 채팅 기능 작동
- 초기화 → 메시지 전송 → LLM 분석 → 응답 수신 (전 과정 정상)
- 모든 인증 단계 통과
- 에러 없는 안정적인 동작

### 2. 환경변수 아키텍처 개선
- 하드코딩 제거로 유지보수성 향상
- Fail-Fast 패턴으로 디버깅 시간 단축
- 단일 설정 파일(.env.local)로 환경 관리

### 3. Secret 관리 표준화
- Google Secret Manager 활용
- 개행 문자 등 특수 문자 처리 검증
- IAM 권한 체계 정립

### 4. 에러 핸들링 개선
- 명확한 HTTP 상태 코드 사용
- 구조화된 에러 타입
- 사용자 친화적 에러 메시지

---

## 🔍 디버깅 과정

### 에러 추적 흐름

```
1. 브라우저 콘솔 에러 확인
   → POST http://localhost:3000/api/chat/init 500

2. Cloud Run 로그 확인
   → ValueError: Invalid header value b'...\n'

3. Secret Manager 검증
   → SUPABASE_ANON_KEY에 개행 문자 발견

4. Secret 재생성 및 배포
   → 500 에러 해결

5. 새로운 에러 발견
   → SUPABASE_SERVICE_ROLE_KEY 누락

6. 환경변수 추가 및 재배포
   → 초기화 성공, 분석 단계 403 에러

7. Authorization 헤더 추가
   → 전체 플로우 정상 작동 확인
```

### 사용된 도구

- **Cloud Run Logs**: 실시간 서버 로그 모니터링
- **Browser Console**: 클라이언트 에러 추적
- **gcloud CLI**: Secret Manager 관리 및 배포
- **Git**: 버전 관리 및 변경사항 추적

---

## 📚 학습 포인트

### 1. Secret Manager 운영
- 개행 문자 등 특수 문자 주의
- `echo -n` 명령어로 개행 제거
- Secret 버전 관리 활용

### 2. Next.js 환경변수
- Server Component: `process.env.XXX`
- Client Component: `process.env.NEXT_PUBLIC_XXX`
- 하드코딩 fallback 지양

### 3. HTTP 인증 플로우
- Authorization 헤더 전파 중요성
- 각 엔드포인트별 인증 요구사항 확인
- JWT 토큰 전달 체계

### 4. Fail-Fast 원칙
- 에러는 빨리 발견할수록 좋음
- 명확한 에러 메시지로 디버깅 시간 단축
- 런타임 전 검증으로 안정성 향상

---

## 🚀 다음 단계

### 권장 작업
1. E2E 테스트 작성 (채팅 플로우)
2. 에러 모니터링 도구 연동 (Sentry 등)
3. 로그 집계 시스템 구축
4. 성능 메트릭 수집

### 운영 체크리스트
- [ ] Cloud Run 모니터링 대시보드 설정
- [ ] Secret 교체 주기 설정 (6개월 권장)
- [ ] 백업 및 재해 복구 계획 수립
- [ ] 부하 테스트 수행

---

## 📞 문제 해결 참고

### Secret Manager 개행 문자 이슈
```bash
# 문제: secret 값에 \n 포함
echo "value_with_newline" | gcloud secrets versions add my-secret --data-file=-

# 해결: -n 플래그 사용
echo -n "value_without_newline" | gcloud secrets versions add my-secret --data-file=-
```

### 환경변수 디버깅
```typescript
// 코드에 임시 로그 추가
console.log('AI_API_URL:', process.env.AI_API_URL);
console.log('NEXT_PUBLIC_AI_API_URL:', process.env.NEXT_PUBLIC_AI_API_URL);

// Cloud Run 환경변수 확인
gcloud run services describe zipcheck-ai --region asia-northeast3 --format="value(spec.template.spec.containers[0].env)"
```

### Authorization 헤더 누락 디버깅
```typescript
// fetch 요청에 헤더 로그 추가
console.log('Request headers:', {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${session.access_token}`,
});
```

---

## 🎉 완료 확인

**사용자 피드백**: "오 드디어, 해결!" (2025-01-29)

**검증 사항**:
- ✅ 채팅 초기화 정상 작동
- ✅ 메시지 전송 및 저장 정상
- ✅ LLM 분석 요청 성공
- ✅ 응답 스트리밍 정상 작동
- ✅ 에러 없는 완전한 플로우

**배포 상태**:
- ✅ Cloud Run 리비전: `zipcheck-ai-00052-p2n`
- ✅ Git 커밋: `d3201b8`
- ✅ GitHub 푸시 완료

---

_작성일: 2025년 1월 29일_
_작성자: Claude (AI Assistant)_
_프로젝트: 집체크 v2 (ZipCheck)_
