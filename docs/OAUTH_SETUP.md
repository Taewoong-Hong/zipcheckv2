# 🔐 OAuth 설정 가이드

ZipCheck v2의 소셜 로그인 설정 가이드입니다.

## 📋 목차
1. [Google OAuth 설정](#google-oauth-설정)
2. [Naver OAuth 설정](#naver-oauth-설정)
3. [Supabase 설정](#supabase-설정)
4. [테스트 방법](#테스트-방법)

---

## Google OAuth 설정

### ✅ 완료된 작업
- Client ID: `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`
- Client Secret: `YOUR_GOOGLE_CLIENT_SECRET`
- 환경변수 설정 완료

### 🔧 추가 설정 필요

#### 1. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. **APIs & Services → Credentials** 이동
3. OAuth 2.0 Client ID 선택 (`YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`)

4. **승인된 JavaScript 원본** 추가:
   ```
   http://localhost:3000
   https://zipcheck.kr
   ```

5. **승인된 리디렉션 URI** 추가:
   ```
   http://localhost:3000/auth/callback
   https://zipcheck.kr/auth/callback
   https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback
   ```

   > ⚠️ **중요**: Supabase 콜백 URI (`https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback`)가 가장 중요합니다!

6. **저장** 클릭

#### 2. Supabase Dashboard 설정

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택: `gsiismzchtgdklvdvggu`
3. **Authentication → Providers → Google** 이동
4. **Enable Google Provider** 토글 활성화
5. 다음 정보 입력:
   - **Client ID**: `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`
   - **Client Secret**: `YOUR_GOOGLE_CLIENT_SECRET`
6. **Save** 클릭

### 📝 로그인 플로우

```
1. 사용자가 "구글로 계속하기" 버튼 클릭
   ↓
2. supabase.auth.signInWithOAuth({ provider: 'google' }) 호출
   ↓
3. Google 로그인 페이지로 리디렉션
   ↓
4. 사용자 로그인 완료 후 Supabase 콜백으로 리디렉션
   (https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback?code=...)
   ↓
5. Supabase가 자동으로 토큰 교환 후 /auth/callback으로 리디렉션
   ↓
6. /auth/callback 페이지에서 세션 확인 및 사용자 정보 저장
   ↓
7. 홈 페이지로 리디렉션 (로그인 완료)
```

---

## Naver OAuth 설정

### ✅ 완료된 작업
- Client ID: `9bLVdkmOcivwS7hSdcDb`
- Client Secret: `V7O77vPf_a`
- 환경변수 설정 완료
- 커스텀 OAuth 플로우 구현 완료

### 🔧 추가 설정 필요

#### 1. Naver Developers 설정

1. [Naver Developers](https://developers.naver.com/apps/#/list) 접속
2. 애플리케이션 선택 (Client ID: `9bLVdkmOcivwS7hSdcDb`)
3. **API 설정** 탭 이동

4. **서비스 URL** 설정:
   ```
   http://localhost:3000
   https://zipcheck.kr
   ```

5. **Callback URL** 설정:
   ```
   http://localhost:3000/auth/naver/callback
   https://zipcheck.kr/auth/naver/callback
   ```

6. **제공 정보 선택**:
   - [x] 회원 이름
   - [x] 이메일 주소
   - [x] 프로필 사진
   - [x] 별명 (선택사항)

7. **저장** 클릭

### 📝 로그인 플로우

```
1. 사용자가 "네이버로 계속하기" 버튼 클릭
   ↓
2. CSRF 토큰 생성 및 sessionStorage 저장
   ↓
3. Naver OAuth URL로 리디렉션
   (https://nid.naver.com/oauth2.0/authorize?...)
   ↓
4. 사용자 로그인 완료 후 /auth/naver/callback으로 리디렉션
   ↓
5. CSRF 토큰 검증 및 authorization code 추출
   ↓
6. FastAPI 백엔드로 코드 전송 (/auth/naver/exchange)
   ↓
7. 백엔드에서 Naver API로 토큰 교환 및 사용자 정보 조회
   ↓
8. Supabase에 사용자 생성/업데이트
   ↓
9. 홈 페이지로 리디렉션 (로그인 완료)
```

---

## Supabase 설정

### ✅ 완료된 작업
- Project URL: `https://gsiismzchtgdklvdvggu.supabase.co`
- Anon Key: `sb_publishable_EGdqKePDQ2veJd13aheY8w_Mn6WMqmx`
- Service Role Key: `sb_secret_mWrf_bxAOf0Q0UP5GYg_Sg_GaixqH8B`
- 환경변수 설정 완료

### 🔧 RLS (Row Level Security) 정책 설정

사용자 데이터 보호를 위해 RLS 정책을 설정해야 합니다.

#### 예시 정책 (contracts 테이블):

```sql
-- 사용자는 자신의 계약서만 조회 가능
CREATE POLICY "Users can view their own contracts"
ON contracts
FOR SELECT
USING (auth.uid() = user_id);

-- 사용자는 자신의 계약서만 생성 가능
CREATE POLICY "Users can create their own contracts"
ON contracts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 계약서만 삭제 가능
CREATE POLICY "Users can delete their own contracts"
ON contracts
FOR DELETE
USING (auth.uid() = user_id);
```

---

## 테스트 방법

### 1. 로컬 개발 서버 시작

```bash
# Next.js 프론트엔드
cd apps/web
npm run dev

# FastAPI 백엔드 (별도 터미널)
cd services/ai
uvicorn app:app --reload
```

### 2. Google 로그인 테스트

1. http://localhost:3000 접속
2. 로그인 모달 열기
3. **"구글로 계속하기"** 클릭
4. Google 계정 선택 및 권한 승인
5. `/auth/callback`으로 리디렉션 확인
6. 홈 페이지로 자동 이동 확인

### 3. Naver 로그인 테스트

1. http://localhost:3000 접속
2. 로그인 모달 열기
3. **"네이버로 계속하기"** 클릭
4. 네이버 로그인 페이지에서 로그인
5. `/auth/naver/callback`으로 리디렉션 확인
6. 백엔드 토큰 교환 완료 확인
7. 홈 페이지로 자동 이동 확인

### 4. 세션 확인

브라우저 콘솔에서 세션 확인:

```javascript
import { supabase } from '@/lib/supabase';

const { data: { session } } = await supabase.auth.getSession();
console.log('User:', session?.user.email);
console.log('Provider:', session?.user.app_metadata.provider);
```

### 5. 로그아웃 테스트

```javascript
await supabase.auth.signOut();
```

---

## 🚨 보안 주의사항

### 1. API Keys 보안
- ✅ `.env` 파일은 절대 Git에 커밋하지 마세요
- ✅ `.gitignore`에 `.env`, `.env.local` 포함 확인
- ✅ 프로덕션 배포 시 환경변수 별도 설정

### 2. CORS 설정
- 프로덕션에서 `AI_ALLOWED_ORIGINS=*` 제거
- 허용할 도메인만 명시: `AI_ALLOWED_ORIGINS=https://zipcheck.kr`

### 3. RLS 정책
- 모든 데이터 테이블에 RLS 활성화 필수
- 사용자별 데이터 격리 보장

### 4. Client Secret 관리
- Client Secret은 절대 프론트엔드에 노출하지 마세요
- 백엔드(FastAPI)에서만 사용

---

## 📁 관련 파일

### Backend (FastAPI)
```
services/ai/
├─ core/
│  ├─ google_oauth.py      # Google OAuth 클라이언트
│  ├─ naver_oauth.py        # Naver OAuth 클라이언트
│  ├─ supabase_client.py    # Supabase 클라이언트
│  └─ settings.py           # 환경변수 설정
├─ routes/
│  └─ auth.py               # OAuth 라우터
└─ .env                     # 환경변수 (비공개)
```

### Frontend (Next.js)
```
apps/web/
├─ lib/
│  └─ supabase.ts                        # Supabase 클라이언트
├─ app/
│  └─ auth/
│     ├─ callback/page.tsx               # Google OAuth 콜백
│     └─ naver/callback/page.tsx         # Naver OAuth 콜백
├─ components/
│  └─ auth/
│     ├─ LoginModal.tsx                  # 로그인 모달
│     └─ SocialLoginButton.tsx           # 소셜 로그인 버튼
└─ .env.local                            # 환경변수 (비공개)
```

---

## 💡 추가 기능 구현 예정

- [ ] Kakao OAuth 구현
- [ ] 이메일/비밀번호 로그인
- [ ] 회원가입 플로우
- [ ] 프로필 관리 페이지
- [ ] 로그인 상태 유지 (세션 관리)
- [ ] 로그아웃 버튼
- [ ] 사용자 프로필 이미지 표시

---

## 🔗 참고 자료

- [Google OAuth 2.0 문서](https://developers.google.com/identity/protocols/oauth2)
- [Naver OAuth 2.0 문서](https://developers.naver.com/docs/login/api/)
- [Supabase Auth 문서](https://supabase.com/docs/guides/auth)
- [Next.js 인증 가이드](https://nextjs.org/docs/authentication)
