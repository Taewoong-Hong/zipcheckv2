# 🔧 로컬 개발 환경 OAuth 리디렉션 수정 가이드

## 문제 상황
Google OAuth 로그인 후 `zipcheck.kr`(프로덕션)로 리디렉션되어 로컬 개발 환경(`localhost:3003`)으로 돌아오지 않는 문제

---

## ✅ 해결 방법

### 1️⃣ Supabase Dashboard에서 Redirect URL 추가

#### Step 1: Supabase Dashboard 접속
```
https://supabase.com/dashboard
→ 프로젝트 선택: gsiismzchtgdklvdvggu
```

#### Step 2: Authentication 설정 이동
```
좌측 메뉴 → Authentication → URL Configuration
```

#### Step 3: Redirect URLs 추가
**"Redirect URLs" 섹션**에 다음 URL들을 **모두** 추가:

```
http://localhost:3000/zc-ops-nx7k2
http://localhost:3003/zc-ops-nx7k2
http://localhost:3000/auth/callback
http://localhost:3003/auth/callback
https://zipcheck.kr/zc-ops-nx7k2
https://zipcheck.kr/auth/callback
```

#### Step 4: Site URL 확인
**"Site URL" 섹션**이 다음과 같이 설정되어 있는지 확인:

```
http://localhost:3000
```

또는 현재 개발 포트에 맞게:

```
http://localhost:3003
```

#### Step 5: 저장
**"Save"** 버튼 클릭

---

### 2️⃣ Google Cloud Console에서 Authorized Redirect URIs 추가

#### Step 1: Google Cloud Console 접속
```
https://console.cloud.google.com
→ APIs & Services → Credentials
```

#### Step 2: OAuth 2.0 Client ID 선택
```
Client ID: 901515411397-soknq5qg2l3ga3ggc3gcrp70rmt2iovt.apps.googleusercontent.com
```

#### Step 3: Authorized redirect URIs 추가
**"Authorized redirect URIs" 섹션**에 다음 URL들을 **모두** 추가:

```
http://localhost:3000/auth/callback
http://localhost:3003/auth/callback
http://localhost:3000/zc-ops-nx7k2
http://localhost:3003/zc-ops-nx7k2
https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback
https://zipcheck.kr/auth/callback
https://zipcheck.kr/zc-ops-nx7k2
```

#### Step 4: 저장
**"Save"** 버튼 클릭

---

### 3️⃣ 환경변수 확인 (이미 완료됨 ✅)

`.env.local` 파일:
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3003
```

---

### 4️⃣ Next.js 서버 재시작

```bash
# 현재 실행 중인 서버 종료 (Ctrl+C)

# 서버 재시작
cd C:\dev\zipcheckv2\apps\web
npm run dev
```

---

## 🧪 테스트

### Step 1: 관리자 페이지 접속
```
http://localhost:3003/zc-ops-nx7k2
```

### Step 2: Google 로그인 클릭
```
"Google 계정으로 로그인" 버튼 클릭
```

### Step 3: 로그인 후 확인
- ✅ **예상 동작**: `http://localhost:3003/zc-ops-nx7k2`로 리디렉션
- ❌ **이전 문제**: `https://zipcheck.kr/zc-ops-nx7k2`로 리디렉션

---

## 🔍 디버깅

### 로그인 플로우 확인

브라우저 개발자 도구 (F12) → Network 탭에서 확인:

1. **OAuth 시작**:
   ```
   Request: https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/authorize?...
   Query Params:
     - redirect_to=http://localhost:3003/zc-ops-nx7k2
     - provider=google
   ```

2. **Google 로그인**:
   ```
   Redirect: https://accounts.google.com/o/oauth2/auth?...
   ```

3. **Supabase 콜백**:
   ```
   Redirect: https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback?code=...
   ```

4. **최종 리디렉션**:
   ```
   ✅ 성공: http://localhost:3003/zc-ops-nx7k2
   ❌ 실패: https://zipcheck.kr/zc-ops-nx7k2
   ```

---

## 📝 원인 분석

### 문제 원인
Supabase Dashboard의 **Redirect URLs 설정**에 `localhost:3003`이 없어서:
- Google OAuth가 로그인 완료 후
- Supabase가 허용된 URL 목록에서 찾지 못하고
- 기본값인 `zipcheck.kr`로 리디렉션

### 해결 원리
1. Supabase Dashboard에 `localhost:3003/zc-ops-nx7k2` 추가
2. Google Cloud Console에 `localhost:3003/auth/callback` 추가
3. 코드는 이미 `window.location.origin` 사용 중이므로 수정 불필요
4. 두 설정이 일치하면 로컬 개발 환경으로 정상 리디렉션

---

## ⚠️ 중요 참고사항

### 포트 변경 시
3000번 포트를 사용하고 싶으시면:

```bash
# 3000번 포트 사용 중인 프로세스 종료
netstat -ano | findstr :3000
taskkill /PID [PID번호] /F

# .env.local 수정
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 서버 재시작
npm run dev
```

### 프로덕션 배포 시
프로덕션 환경에서는 `https://zipcheck.kr`만 유지하고 `localhost` URL은 삭제 권장

---

## ✅ 체크리스트

- [ ] Supabase Dashboard에 `http://localhost:3003/zc-ops-nx7k2` 추가
- [ ] Supabase Dashboard에 `http://localhost:3003/auth/callback` 추가
- [ ] Google Cloud Console에 `http://localhost:3003/auth/callback` 추가
- [ ] `.env.local`에 `NEXT_PUBLIC_APP_URL=http://localhost:3003` 설정
- [ ] Next.js 서버 재시작
- [ ] `http://localhost:3003/zc-ops-nx7k2` 접속 테스트
- [ ] Google OAuth 로그인 테스트
- [ ] 로컬 환경으로 정상 리디렉션 확인

---

**작성일**: 2025-01-24
**문제**: Google OAuth 로그인 후 zipcheck.kr로 리디렉션됨
**해결**: Supabase + Google Cloud Console에 localhost URL 추가
