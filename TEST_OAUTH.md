# 🧪 OAuth 로그인 테스트 가이드

## ✅ 현재 상태
- ✅ Next.js 개발 서버 실행 중: **http://localhost:3001**
- ✅ Google OAuth 클라이언트 구현 완료
- ✅ Naver OAuth 클라이언트 구현 완료
- ✅ Supabase 클라이언트 설정 완료

---

## 🔧 OAuth 제공자 설정 상태

### Google OAuth
- **Client ID**: `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`
- **Client Secret**: `YOUR_GOOGLE_CLIENT_SECRET`
- **현재 Redirect URI**:
  - `http://localhost:3001/auth/callback` (테스트용)
  - `https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback` (Supabase)

### Naver OAuth
- **Client ID**: `9bLVdkmOcivwS7hSdcDb`
- **Client Secret**: `V7O77vPf_a`
- **현재 Redirect URI**:
  - `http://localhost:3001/auth/naver/callback` (테스트용)

---

## 📋 테스트 단계

### 1️⃣ Google Cloud Console에 Redirect URI 추가

**검증 중이라면 실패할 수 있습니다**

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 접속
2. OAuth 2.0 Client ID 선택
3. **승인된 리디렉션 URI**에 추가:
   ```
   http://localhost:3001/auth/callback
   ```
4. 저장

### 2️⃣ Naver Developers에 Callback URL 추가

**검증 중이라면 실패할 수 있습니다**

1. [Naver Developers](https://developers.naver.com/apps/#/list) 접속
2. 애플리케이션 선택
3. **Callback URL**에 추가:
   ```
   http://localhost:3001/auth/naver/callback
   ```
4. **서비스 URL**에 추가:
   ```
   http://localhost:3001
   ```
5. 저장

### 3️⃣ Supabase Dashboard에서 Google Provider 활성화

**필수 설정**

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택: `gsiismzchtgdklvdvggu`
3. **Authentication → Providers → Google** 이동
4. **Enable Google** 토글 ON
5. 입력:
   - **Client ID**: `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`
   - **Client Secret**: `YOUR_GOOGLE_CLIENT_SECRET`
6. **Save** 클릭

---

## 🧪 브라우저 테스트

### Google 로그인 테스트

1. **브라우저에서 접속**:
   ```
   http://localhost:3001
   ```

2. **로그인 모달 열기**

3. **"구글로 계속하기" 클릭**

4. **예상 플로우**:
   ```
   로컬 페이지 → Google 로그인 → Supabase 콜백 → /auth/callback → 홈
   ```

5. **성공 시나리오**:
   - Google 계정 선택 화면 표시
   - 권한 승인 화면 표시
   - `/auth/callback` 페이지로 리디렉션
   - "로그인 성공!" 메시지 표시
   - 자동으로 홈 페이지로 이동

6. **실패 시나리오 (검증 중)**:
   - ❌ "redirect_uri_mismatch" 에러
   - ❌ "invalid_client" 에러
   - 원인: Google OAuth 앱이 아직 검증 중이거나 Redirect URI가 등록되지 않음

### Naver 로그인 테스트

1. **브라우저에서 접속**:
   ```
   http://localhost:3001
   ```

2. **로그인 모달 열기**

3. **"네이버로 계속하기" 클릭**

4. **예상 플로우**:
   ```
   로컬 페이지 → Naver 로그인 → /auth/naver/callback → FastAPI 토큰 교환 → 홈
   ```

5. **성공 시나리오**:
   - 네이버 로그인 페이지로 리디렉션
   - 로그인 완료 후 `/auth/naver/callback`으로 리디렉션
   - "네이버 로그인 처리 중..." 메시지 표시
   - 백엔드에서 토큰 교환 완료
   - "로그인 성공!" 메시지 표시
   - 자동으로 홈 페이지로 이동

6. **실패 시나리오 (검증 중)**:
   - ❌ "callback_url_mismatch" 에러
   - ❌ "invalid_client" 에러
   - 원인: Naver 앱이 아직 검증 중이거나 Callback URL이 등록되지 않음

---

## 🐛 예상되는 문제 및 해결

### 문제 1: "redirect_uri_mismatch"

**원인**: OAuth 앱에 Redirect URI가 등록되지 않음

**해결**:
- Google: Cloud Console에서 `http://localhost:3001/auth/callback` 추가
- Naver: Developers에서 `http://localhost:3001/auth/naver/callback` 추가

### 문제 2: "앱이 검증되지 않음" 경고 (Google)

**원인**: Google OAuth 앱이 아직 검증 전 상태

**해결**:
- **테스트 계정 추가**: Google Cloud Console → OAuth 동의 화면 → 테스트 사용자 추가
- **또는**: "고급" → "안전하지 않은 페이지로 이동(안전하지 않음)" 클릭 (개발 중에만)

### 문제 3: "서비스 점검 중" (Naver)

**원인**: Naver 앱이 검토 중이거나 서비스 URL이 미등록

**해결**:
- Naver Developers에서 앱 상태 확인
- 서비스 URL에 `http://localhost:3001` 등록 확인

### 문제 4: Supabase 연결 실패

**증상**: Google 로그인 후 "세션을 생성하지 못했습니다" 에러

**해결**:
- Supabase Dashboard에서 Google Provider 활성화 확인
- Client ID/Secret 정확성 확인
- Supabase 콜백 URI가 Google에 등록되었는지 확인

---

## 🔍 디버깅 방법

### 브라우저 콘솔 확인

1. F12 → Console 탭 열기
2. 로그인 버튼 클릭 시 출력 확인:
   ```
   google 로그인 시도
   또는
   naver 로그인 시도
   ```

3. 에러 메시지 확인:
   ```
   Google 로그인 오류: ...
   또는
   Naver OAuth error: ...
   ```

### Network 탭 확인

1. F12 → Network 탭
2. 로그인 시도 시 요청 확인:
   - Google: `https://accounts.google.com/o/oauth2/v2/auth`
   - Naver: `https://nid.naver.com/oauth2.0/authorize`

3. 리디렉션 확인:
   - `/auth/callback` 또는 `/auth/naver/callback`

### FastAPI 백엔드 로그 (Naver용)

Naver 로그인 실패 시 FastAPI 로그 확인 필요:
```bash
cd services/ai
uvicorn app:app --reload
```

---

## ✅ 테스트 체크리스트

### 사전 설정
- [ ] Google Cloud Console에 Redirect URI 추가
- [ ] Naver Developers에 Callback URL 추가
- [ ] Supabase Dashboard에서 Google Provider 활성화

### Google 로그인
- [ ] "구글로 계속하기" 버튼 클릭
- [ ] Google 로그인 페이지 표시
- [ ] 계정 선택 및 권한 승인
- [ ] `/auth/callback`으로 리디렉션
- [ ] "로그인 성공!" 메시지 표시
- [ ] 홈 페이지로 자동 이동

### Naver 로그인
- [ ] "네이버로 계속하기" 버튼 클릭
- [ ] 네이버 로그인 페이지 표시
- [ ] 로그인 완료
- [ ] `/auth/naver/callback`으로 리디렉션
- [ ] 백엔드 토큰 교환 성공
- [ ] "로그인 성공!" 메시지 표시
- [ ] 홈 페이지로 자동 이동

---

## 📝 테스트 결과 기록

### Google 로그인
- **날짜**:
- **결과**: ⬜ 성공 / ⬜ 실패
- **에러 메시지**:
- **비고**:

### Naver 로그인
- **날짜**:
- **결과**: ⬜ 성공 / ⬜ 실패
- **에러 메시지**:
- **비고**:

---

## 🎯 다음 단계

검증이 완료되면:
1. 프로덕션 Redirect URI 추가 (`https://zipcheck.kr/...`)
2. 로그인 상태 UI 구현
3. 로그아웃 기능 구현
4. 프로필 관리 페이지 구현
5. Kakao OAuth 추가 구현
