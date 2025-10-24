# hourhong@zipcheck.kr 관리자 설정 가이드

## ✅ 현재 상태
- [x] Google Workspace 활성화 완료
- [x] hourhong@zipcheck.kr 계정 생성 완료
- [ ] Supabase 데이터베이스 설정
- [ ] 관리자 권한 부여
- [ ] 대시보드 접속 테스트

---

## 🚀 설정 단계

### 1단계: 먼저 한 번 로그인 (users 테이블 레코드 생성)

```bash
# Next.js 개발 서버 시작
cd C:\dev\zipcheckv2\apps\web
npm run dev
```

1. **브라우저에서 접속**: http://localhost:3000
2. **로그인 버튼 클릭** (또는 메인 페이지 우측 상단)
3. **"구글로 계속하기"** 클릭
4. **hourhong@zipcheck.kr** 계정 선택
5. **Google 2단계 인증** 완료 (설정되어 있다면)
6. **로그인 완료 확인** (프로필 표시)
7. **로그아웃** (우측 상단 메뉴)

> ⚠️ 이 단계는 **필수**입니다!
> Google OAuth로 처음 로그인하면 Supabase가 자동으로 `users` 테이블에 레코드를 생성합니다.

---

### 2단계: Supabase SQL Editor에서 관리자 권한 부여

#### 방법 A: Supabase Dashboard (웹)

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택: `gsiismzchtgdklvdvggu`

2. **SQL Editor 이동**
   - 좌측 메뉴 → **SQL Editor**

3. **SQL 실행**
   - **New query** 클릭
   - `C:\dev\zipcheckv2\setup_admin_quick.sql` 파일 내용 복사
   - 붙여넣기 후 **Run** 클릭

4. **결과 확인**
   ```
   ✅ 설정 완료!
   이제 http://localhost:3000/zc-ops-nx7k2 접속 가능
   ```

#### 방법 B: psql CLI (선택사항)

```bash
# Supabase Dashboard에서 연결 문자열 복사
# Database → Connection string → URI

psql "postgresql://postgres.[PASSWORD]@db.gsiismzchtgdklvdvggu.supabase.co:5432/postgres"

# SQL 파일 실행
\i C:/dev/zipcheckv2/setup_admin_quick.sql

# 확인
SELECT id, email, role FROM public.users WHERE email = 'hourhong@zipcheck.kr';
```

---

### 3단계: 관리자 대시보드 접속 테스트

1. **브라우저 새 탭에서 접속**:
   ```
   http://localhost:3000/zc-ops-nx7k2
   ```

2. **예상 동작**:
   - ✅ **로그인 완료 상태**: 바로 대시보드 표시
   - ❌ **로그아웃 상태**: Google 로그인 화면 표시

3. **로그인 화면이 뜨면**:
   - "Google 계정으로 로그인" 버튼 클릭
   - hourhong@zipcheck.kr 선택
   - 2단계 인증 (필요 시)
   - **4단계 보안 검증 통과**:
     - ✅ Google OAuth SSO
     - ✅ 도메인 화이트리스트 (@zipcheck.kr)
     - ✅ 2단계 인증 (MFA)
     - ✅ 관리자 권한 (role = 'admin')
   - 대시보드 표시!

---

## 🎯 테스트 체크리스트

### ✅ 로그인 테스트

- [ ] http://localhost:3000 접속
- [ ] Google OAuth로 hourhong@zipcheck.kr 로그인
- [ ] 프로필에 이메일 표시 확인
- [ ] 로그아웃 버튼 동작 확인

### ✅ 관리자 대시보드 테스트

- [ ] http://localhost:3000/zc-ops-nx7k2 접속
- [ ] 보안 검증 통과 확인
- [ ] 대시보드 헤더 표시 (hourhong@zipcheck.kr)
- [ ] KPI 카드 로딩 (GA4 미설정 시 에러 정상)
- [ ] 전환 퍼널 차트 표시
- [ ] 유입 채널 차트 표시
- [ ] 로그아웃 버튼 동작

### ✅ 보안 테스트 (다른 계정)

- [ ] 다른 Gmail 계정으로 로그인 시도
  - 예상: "허용된 도메인(@zipcheck.kr)이 아닙니다" 에러
- [ ] @zipcheck.kr 도메인이지만 role = 'user'인 계정으로 시도
  - 예상: "관리자 권한이 없습니다" 에러

---

## 🛠️ 트러블슈팅

### ❌ "사용자 정보를 조회할 수 없습니다"

**원인**: users 테이블에 레코드가 없음

**해결**:
1. http://localhost:3000 접속
2. Google OAuth로 로그인 (hourhong@zipcheck.kr)
3. 로그아웃
4. Supabase SQL Editor에서 다시 확인:
   ```sql
   SELECT id, email, role FROM public.users WHERE email = 'hourhong@zipcheck.kr';
   ```
5. 레코드 있으면 role을 'admin'으로 업데이트:
   ```sql
   UPDATE public.users SET role = 'admin' WHERE email = 'hourhong@zipcheck.kr';
   ```

---

### ❌ "Google 계정에서 2단계 인증을 활성화해주세요"

**원인**: Google 계정에 2단계 인증이 비활성화됨

**해결**:
1. https://myaccount.google.com/security 접속
2. "2단계 인증" → "사용 설정"
3. 휴대전화 또는 보안키 등록
4. 다시 로그인 시도

---

### ❌ "허용된 도메인(@zipcheck.kr)이 아닙니다"

**원인**: 개인 Gmail 계정으로 로그인 시도

**해결**: hourhong@zipcheck.kr (Google Workspace) 계정 사용 필요

---

### ❌ KPI 카드에 "데이터를 불러올 수 없습니다" 표시

**원인**: GA4 설정 누락 (정상)

**해결** (선택사항):
1. Google Analytics 4 설정
2. 서비스 계정 키 생성
3. `.env.local` 파일에 추가:
   ```bash
   GA4_PROPERTY_ID=your_property_id
   GA_SERVICE_ACCOUNT_KEY_JSON={"type":"service_account",...}
   ```
4. Next.js 서버 재시작

> ⚠️ GA4 없이도 관리자 페이지 접속 및 권한 검증은 정상 동작합니다.
> KPI 데이터만 로딩 실패 메시지가 표시될 뿐입니다.

---

## 📊 데이터베이스 상태 확인

### Supabase SQL Editor에서 실행

```sql
-- 1. 관리자 계정 확인
SELECT
  id,
  email,
  role,
  created_at,
  updated_at
FROM public.users
WHERE role = 'admin';

-- 예상 결과:
-- email: hourhong@zipcheck.kr
-- role: admin

-- 2. admin_logs 테이블 확인
SELECT COUNT(*) FROM public.admin_logs;

-- 예상 결과: 0 (처음에는 로그 없음, 정상)

-- 3. RLS 정책 확인
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('users', 'admin_logs');

-- 예상 결과: 여러 정책 표시 (정상)

-- 4. 헬퍼 함수 확인
SELECT
  proname,
  prosrc
FROM pg_proc
WHERE proname IN ('is_admin', 'log_admin_action');

-- 예상 결과: 2개 함수 표시 (정상)
```

---

## 🎉 성공 시 화면

### 관리자 대시보드 (http://localhost:3000/zc-ops-nx7k2)

```
┌─────────────────────────────────────────────────────────┐
│ 🎯 집체크 관리자                                         │
│ 실시간 운영 대시보드                                     │
│                                          ✅ 보안 인증 완료│
│                                    hourhong@zipcheck.kr │
│                                          [로그아웃]      │
└─────────────────────────────────────────────────────────┘

📈 핵심 지표 (최근 7일)
┌──────────────┬──────────────┬──────────────┐
│ 활성 사용자  │ 신규 사용자  │ 세션 수      │
│ [로딩중...]  │ [로딩중...]  │ [로딩중...]  │
└──────────────┴──────────────┴──────────────┘

📊 전환 퍼널 분석
┌─────────────────────────────────────────────┐
│ [차트 로딩중...]                            │
└─────────────────────────────────────────────┘

👥 유입 채널 TOP 10
┌─────────────────────────────────────────────┐
│ [차트 로딩중...]                            │
└─────────────────────────────────────────────┘
```

> 📝 GA4 미설정 시 차트는 "데이터를 불러올 수 없습니다" 메시지 표시 (정상)

---

## 📝 다음 단계

### 운영 환경 배포 시

1. **프로덕션 환경변수 설정** (Vercel/Cloud Run)
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://gsiismzchtgdklvdvggu.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id
   GA4_PROPERTY_ID=your_property_id (선택사항)
   GA_SERVICE_ACCOUNT_KEY_JSON={"type":"service_account",...} (선택사항)
   ```

2. **Google Cloud Console 리디렉션 URI 추가**
   ```
   https://zipcheck.kr/zc-ops-nx7k2
   https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback
   ```

3. **Supabase 프로덕션 DB에 SQL 적용**
   - Supabase Dashboard → SQL Editor
   - `setup_admin_quick.sql` 실행

4. **Google Workspace 2단계 인증 강제 설정**
   - admin.google.com → 보안 → 2단계 인증 → **필수**

---

**작성일**: 2025-01-24
**대상**: hourhong@zipcheck.kr 관리자 계정
