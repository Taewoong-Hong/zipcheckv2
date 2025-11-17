# 관리자 대시보드 빠른 설정 가이드

## ✅ 최종 구현 방식

**Supabase Email/Password 로그인 + `role = 'admin'` 검증**

### 특징
- ✅ 메인 서비스에 이미 로그인되어 있으면 **바로 대시보드 접속 가능**
- ✅ 로그인 안 되어 있으면 관리자 전용 로그인 폼 표시
- ✅ `role = 'admin'`인 사용자만 접근 가능
- ✅ 일반 사용자는 로그인해도 "권한 없음" 메시지 + 자동 로그아웃

---

## 🚀 설정 방법 (5분)

### 1단계: Supabase 데이터베이스 설정

**Supabase SQL Editor**에서 다음 SQL 실행:

```sql
-- users 테이블에 role 컬럼 추가 (이미 있으면 생략)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 관리자 계정 생성 (Supabase Auth에서 먼저 회원가입 필요)
-- 1. Supabase Dashboard → Authentication → Users에서 이메일 확인
-- 2. 해당 이메일의 role을 admin으로 변경
UPDATE public.users
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';

-- 확인
SELECT id, email, role FROM public.users WHERE role = 'admin';
```

### 2단계: GA4 설정 (선택사항)

**GA4 Data API를 사용하려면**:

1. **Google Cloud Console** → GA4 Data API 활성화
2. **서비스 계정 생성** → JSON 키 다운로드
3. **GA4 속성** → 서비스 계정에 뷰어 권한 부여
4. **환경변수 설정**:

```bash
# apps/web/.env.local
GA4_PROPERTY_ID=123456789
GA_SERVICE_ACCOUNT_KEY_JSON={"type":"service_account",...}
```

> ⚠️ GA4 없이도 관리자 페이지 접속 및 로그인은 동작합니다.
> KPI 데이터만 로딩 실패 메시지가 표시됩니다.

### 3단계: 테스트

#### 3-1. 관리자 계정 생성
```bash
# 방법 1: Supabase Dashboard에서 직접 생성
1. Supabase Dashboard → Authentication → Users
2. Add User → Email/Password 입력 후 생성
3. SQL Editor에서 role = 'admin' 설정

# 방법 2: 메인 서비스에서 회원가입 후 SQL로 권한 부여
1. http://localhost:3000 접속
2. 회원가입 (Google OAuth 또는 Email)
3. Supabase SQL Editor에서 role 변경
```

#### 3-2. 접속 테스트

**Case 1: 로그인 안 된 상태**
```
http://localhost:3000/zc-ops-nx7k2
→ 관리자 로그인 폼 표시
→ 이메일/비밀번호 입력
→ role = 'admin' 체크
→ 대시보드 표시
```

**Case 2: 이미 메인 서비스에 로그인된 상태 (role = 'admin')**
```
http://localhost:3000/zc-ops-nx7k2
→ 로그인 폼 건너뛰고
→ 바로 대시보드 표시 ✅
```

**Case 3: 일반 사용자로 로그인된 상태 (role = 'user')**
```
http://localhost:3000/zc-ops-nx7k2
→ "권한 없음" 에러
→ 자동 로그아웃
→ 로그인 폼으로 이동
```

---

## 📊 대시보드 기능

### 현재 구현된 기능
- ✅ **로그인/로그아웃** (Supabase Auth)
- ✅ **KPI 카드**: Active Users, New Users, Sessions 등 (GA4 연동 시)
- ✅ **전환 퍼널**: 사용자 여정 단계별 전환율
- ✅ **유입 채널**: TOP 10 트래픽 소스
- ✅ **5분 캐싱**: API 호출 최적화

### UI/UX
- 🎨 **다크 테마**: Gray-900 + Pink 계열 그라데이션
- 📱 **반응형**: 모바일/태블릿/데스크톱 지원
- 🔒 **보안**: 예측 불가능한 URL (`/zc-ops-nx7k2`)
- 👁️ **비밀번호 표시/숨김** 토글
- ⚡ **로딩 상태** 표시

---

## 🔐 보안 체크리스트

- [x] 예측 불가능한 URL 사용
- [x] Supabase Auth 세션 검증
- [x] `role = 'admin'` 이중 검증
- [x] 일반 사용자 자동 차단
- [x] 서버 전용 API 라우트 (GA4)
- [x] 클라이언트에서 직접 GA API 호출 금지
- [x] 환경변수로 민감 정보 관리

---

## 🐛 트러블슈팅

### "사용자 정보를 조회할 수 없습니다"
**원인**: users 테이블에 해당 사용자 레코드가 없음
**해결**:
1. Supabase → Authentication → Users에서 사용자 ID 확인
2. SQL Editor에서 users 테이블 조회
3. 레코드 없으면 수동 삽입:
   ```sql
   INSERT INTO public.users (id, email, role)
   VALUES ('user-id-from-auth', 'admin@example.com', 'admin');
   ```

### "관리자 권한이 없습니다"
**원인**: `role` 컬럼이 'user'로 설정됨
**해결**:
```sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

### GA4 데이터가 표시되지 않음
**원인**: GA4 설정 누락 또는 Property ID 오류
**해결**:
1. `.env.local`에서 `GA4_PROPERTY_ID` 확인 (숫자 형태)
2. 서비스 계정 키 JSON이 올바른지 확인
3. GA4 속성에서 서비스 계정 권한 확인

---

## 📝 다음 단계

### 추가 기능 구현
- [ ] 사용자 관리 (활성화/비활성화)
- [ ] 결제 내역 조회
- [ ] PDF 업로드 대기열 모니터링
- [ ] 에러 로그 대시보드
- [ ] 실시간 알림 시스템

### 프로덕션 배포
- [ ] Cloud Run/Vercel 배포
- [ ] 환경변수 설정
- [ ] HTTPS 적용
- [ ] Rate Limiting 추가
- [ ] 로그 모니터링 (Sentry)

---

**작성일**: 2025-01-24
**버전**: 1.0.0
