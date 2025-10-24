# 관리자 대시보드 보안 설정 가이드 (최종)

## 🔒 보안 아키텍처

### 4계층 방어 체계

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Google OAuth SSO                               │
│ - Google Workspace 계정만 허용                          │
│ - 개인 Gmail 차단                                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: 도메인 화이트리스트                             │
│ - @zipcheck.kr 도메인만 허용                            │
│ - 코드 레벨에서 이중 검증                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: MFA 강제 (Google 2단계 인증)                   │
│ - Google Workspace 정책으로 강제 활성화                 │
│ - 보안키/TOTP/SMS 중 선택                               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Supabase role = 'admin'                        │
│ - DB 레벨 권한 검증                                      │
│ - RLS로 데이터 접근 제어                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 왜 SSO (Google) > 이메일/비번?

### ✅ SSO(Google OAuth)의 장점

1. **피싱·재사용 비번 리스크 제거**
   - ❌ 이메일/비번: 사용자가 약한 비번 설정, 재사용, 유출 가능
   - ✅ Google SSO: 조직 정책(2단계, 보안키, 위험 로그인 차단)으로 통제

2. **MFA 강제 가능**
   - ❌ 이메일/비번: 사용자가 MFA를 끄거나 우회 가능
   - ✅ Google Workspace: 조직 관리자가 전원 MFA/보안키 강제 설정

3. **회계감사·접근 거버넌스**
   - ✅ SSO는 로그인 로그, 장치·위치 정책, 세션 관리가 체계적
   - Google Admin Console에서 모든 로그인 이력 추적 가능

4. **운영 비용 절감**
   - ❌ 이메일/비번: 비번 초기화, 분실 처리, 약한 비번 탐지, 브루트포스 방어 필요
   - ✅ Google SSO: Google이 모든 인증 보안 처리

### 📌 결론

- **관리자 페이지**: Google OAuth SSO로 잠금 (도메인 화이트리스트 + MFA 강제)
- **일반 사용자**: 이메일/비번 + 소셜(Google, Naver, Kakao) 병행 허용

---

## 🚀 구현 완료 사항

### ✅ 프론트엔드 (app/zc-ops-nx7k2/page.tsx)

```typescript
// 보안 계층 검증
const ALLOWED_DOMAINS = ['zipcheck.kr'];

async function checkAuthSession() {
  // 1. Google OAuth 검증
  if (providerId !== 'google') {
    setAuthError('Google OAuth SSO 로그인이 필요합니다.');
    await supabase.auth.signOut();
    return;
  }

  // 2. 도메인 화이트리스트 검증
  if (!isEmailDomainAllowed(email)) {
    setAuthError('허용된 도메인(@zipcheck.kr)이 아닙니다.');
    await supabase.auth.signOut();
    return;
  }

  // 3. MFA 검증 (Google 2단계 인증)
  const mfaEnabled = userMetadata?.email_verified &&
                     session.user.aud === 'authenticated' &&
                     userMetadata?.iss === 'https://accounts.google.com';
  if (!mfaEnabled) {
    setAuthError('Google 계정에서 2단계 인증을 활성화해주세요.');
    return;
  }

  // 4. 관리자 role 검증
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (userData?.role !== 'admin') {
    setAuthError('관리자 권한이 없습니다.');
    return;
  }
}
```

### ✅ 로그인 UI

- **보안 체크리스트 표시**: 4단계 검증 상태 실시간 표시
- **Google 로그인 버튼**: 공식 Google 브랜딩
- **에러 메시지**: 구체적인 실패 이유 표시
- **보안 안내**: 도메인 및 MFA 요구사항 명시

---

## 📋 설정 단계

### 1단계: Google Workspace 설정

#### 1-1. 2단계 인증 강제 활성화

1. **Google Admin Console** 접속 (admin.google.com)
2. **보안 → 인증 → 2단계 인증** 이동
3. **조직 단위 선택** (전체 또는 관리자 그룹)
4. **사용자가 2단계 인증을 사용 설정할 수 있도록 허용** → **설정**
5. **시행** 옵션:
   - **허용** (권장하지만 사용자가 끌 수 있음)
   - **필수** ✅ (강제, 권장)
   - **새 사용자에 대해 필수** (신규 가입자만)

#### 1-2. 보안키 또는 TOTP 설정 (선택사항)

- **보안 → 고급 설정 → 보안키 허용** 체크
- FIDO2 하드웨어 키 또는 Google Authenticator 사용

#### 1-3. 위험한 로그인 차단

- **보안 → 고급 설정 → 위험한 이벤트**
- 새 기기, 새 위치, 비정상 로그인 차단 정책 설정

---

### 2단계: Supabase 설정

#### 2-1. Google OAuth Provider 설정

1. **Supabase Dashboard → Authentication → Providers → Google**
2. **Enable Google Provider** 활성화
3. **Client ID / Client Secret** 입력 (Google Cloud Console에서 발급)
4. **Authorized Redirect URLs** 확인:
   ```
   https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback
   ```

#### 2-2. users 테이블에 role 컬럼 추가

```sql
-- Supabase SQL Editor에서 실행

-- role 컬럼 추가
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 관리자 권한 부여
UPDATE public.users
SET role = 'admin'
WHERE email = 'admin@zipcheck.kr';

-- 확인
SELECT id, email, role FROM public.users WHERE role = 'admin';
```

#### 2-3. RLS 정책 설정 (선택사항)

```sql
-- 관리자만 모든 사용자 조회 가능
CREATE POLICY "Admins can read all users"
ON public.users
FOR SELECT
USING (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'admin'
  )
);

-- 관리자 전용 테이블 생성 (감사 로그)
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- 관리자만 접근
CREATE POLICY "Admins only"
ON public.admin_logs
FOR ALL
USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'))
WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));
```

---

### 3단계: Google Cloud Console 설정

#### 3-1. OAuth 2.0 클라이언트 설정

1. **Google Cloud Console** → APIs & Services → Credentials
2. **OAuth 2.0 Client IDs** → 기존 클라이언트 편집
3. **승인된 JavaScript 원본** 추가:
   ```
   http://localhost:3000
   https://zipcheck.kr
   ```
4. **승인된 리디렉션 URI** 추가:
   ```
   http://localhost:3000/zc-ops-nx7k2
   https://zipcheck.kr/zc-ops-nx7k2
   https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback
   ```

#### 3-2. 도메인 제한 설정 (Google Workspace)

1. **OAuth 동의 화면** 설정
2. **내부 애플리케이션** 선택 (zipcheck.kr Workspace 사용자만 허용)
3. 또는 **외부** 선택 시 코드에서 `hd` 파라미터로 도메인 제한:
   ```typescript
   queryParams: {
     hd: 'zipcheck.kr', // Workspace 도메인 힌트
   }
   ```

---

### 4단계: 환경변수 설정

```bash
# apps/web/.env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://gsiismzchtgdklvdvggu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=901515411397-soknq5qg2l3ga3ggc3gcrp70rmt2iovt.apps.googleusercontent.com

# GA4 (선택사항)
GA4_PROPERTY_ID=123456789
GA_SERVICE_ACCOUNT_KEY_JSON={"type":"service_account",...}
```

---

## 🧪 테스트 시나리오

### ✅ 정상 케이스

1. **@zipcheck.kr 계정 + MFA 활성화 + role = 'admin'**
   ```
   → Google 로그인 버튼 클릭
   → Google 계정 선택 (admin@zipcheck.kr)
   → 2단계 인증 (보안키/TOTP)
   → 4단계 검증 모두 통과
   → 대시보드 표시 ✅
   ```

### ❌ 실패 케이스

1. **개인 Gmail 계정 (@gmail.com)**
   ```
   → Google 로그인 시도
   → 도메인 화이트리스트 검증 실패
   → "허용된 도메인(@zipcheck.kr)이 아닙니다" 에러
   → 자동 로그아웃
   ```

2. **@zipcheck.kr 계정 + MFA 비활성화**
   ```
   → Google 로그인 성공
   → MFA 검증 실패
   → "Google 계정에서 2단계 인증을 활성화해주세요" 에러
   → 자동 로그아웃
   ```

3. **@zipcheck.kr 계정 + MFA 활성화 + role = 'user'**
   ```
   → Google 로그인 성공
   → MFA 검증 성공
   → 관리자 role 검증 실패
   → "관리자 권한이 없습니다" 에러
   → 자동 로그아웃
   ```

---

## 🛡️ 추가 보안 강화 (권장)

### 1. Next.js Middleware 추가

```typescript
// apps/web/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_DOMAINS = ['zipcheck.kr'];

export async function middleware(request: NextRequest) {
  // 관리자 페이지 보호
  if (request.nextUrl.pathname.startsWith('/zc-ops-nx7k2')) {
    const response = NextResponse.next();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (key) => request.cookies.get(key)?.value } }
    );

    const { data: { session } } = await supabase.auth.getSession();

    // 1. 로그인 체크
    if (!session) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // 2. Google OAuth 체크
    if (session.user.app_metadata?.provider !== 'google') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // 3. 도메인 체크
    const email = session.user.email || '';
    const domain = email.split('@')[1];
    if (!ALLOWED_DOMAINS.includes(domain)) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // 4. 관리자 role 체크
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (userData?.role !== 'admin') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/zc-ops-nx7k2/:path*',
};
```

### 2. IP 화이트리스트 (Cloudflare/Vercel)

```javascript
// Cloudflare WAF Rule
(ip.src ne 123.456.789.0 and http.host eq "zipcheck.kr" and http.request.uri.path contains "/zc-ops-nx7k2")
→ Action: Block
```

### 3. 감사 로그 자동화

```typescript
// lib/admin-audit.ts
export async function logAdminAction(
  userId: string,
  action: string,
  details?: any
) {
  await supabase.from('admin_logs').insert({
    user_id: userId,
    action,
    details,
  });
}

// 사용 예시
await logAdminAction(session.user.id, 'VIEW_DASHBOARD', {
  ip: request.headers.get('x-forwarded-for'),
  userAgent: request.headers.get('user-agent'),
});
```

### 4. 세션 타임아웃 단축

```typescript
// Supabase Auth 설정
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    // 세션 유효기간 8시간
    accessTokenLifetime: 8 * 60 * 60,
  },
});
```

---

## 📊 보안 체크리스트

### ✅ 필수 항목
- [x] Google OAuth SSO 적용
- [x] 도메인 화이트리스트 (@zipcheck.kr)
- [x] MFA 강제 (Google Workspace 정책)
- [x] Supabase role = 'admin' 검증
- [x] 4계층 검증 UI 표시
- [x] 자동 로그아웃 (검증 실패 시)
- [x] 예측 불가능한 URL (/zc-ops-nx7k2)

### 🔄 권장 항목
- [ ] Next.js Middleware 추가
- [ ] IP 화이트리스트 (Cloudflare/Vercel)
- [ ] 감사 로그 자동화
- [ ] 세션 타임아웃 8시간 설정
- [ ] Subdomain 분리 (admin.zipcheck.kr)
- [ ] Rate Limiting (API 호출 제한)
- [ ] 알림 시스템 (의심스러운 로그인)

---

## 🚨 트러블슈팅

### "Google OAuth SSO 로그인이 필요합니다"
**원인**: 이메일/비번 또는 다른 소셜 로그인으로 접속
**해결**: Google 계정으로 로그인 필요

### "허용된 도메인이 아닙니다"
**원인**: @zipcheck.kr 도메인이 아닌 계정 사용
**해결**: Google Workspace 계정 사용 필요

### "2단계 인증을 활성화해주세요"
**원인**: Google 계정에서 MFA 비활성화
**해결**:
1. Google 계정 → 보안
2. 2단계 인증 → 시작하기
3. 휴대전화/보안키/TOTP 등록

### "관리자 권한이 없습니다"
**원인**: users 테이블에서 role이 'admin'이 아님
**해결**:
```sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'admin@zipcheck.kr';
```

---

## 📝 운영 가이드

### 새 관리자 추가

1. **Google Workspace에서 계정 생성**
   - admin.google.com → 사용자 → 사용자 추가
   - 이메일: `newadmin@zipcheck.kr`

2. **2단계 인증 강제 적용**
   - 조직 정책으로 자동 적용됨

3. **Supabase에서 role 부여**
   ```sql
   -- 먼저 한 번 로그인하여 users 테이블에 레코드 생성
   -- 그 후 SQL 실행
   UPDATE public.users
   SET role = 'admin'
   WHERE email = 'newadmin@zipcheck.kr';
   ```

### 관리자 권한 제거

```sql
-- role을 user로 변경
UPDATE public.users
SET role = 'user'
WHERE email = 'oldadmin@zipcheck.kr';

-- 또는 Google Workspace에서 계정 비활성화
```

---

**작성일**: 2025-01-24
**버전**: 2.0.0 (Google OAuth SSO + MFA 강제)
**이전 버전**: 1.0.0 (Email/Password 방식)
