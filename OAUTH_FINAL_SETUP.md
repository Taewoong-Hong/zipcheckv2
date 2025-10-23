# 🔐 OAuth 최종 설정 가이드 (통합본)

## ✅ 현재 상태
- ✅ Google, Kakao, Naver 로그인 코드 모두 구현 완료
- ✅ Next.js 서버 실행 중: **http://localhost:3001**
- ✅ Supabase 프로젝트: `gsiismzchtgdklvdvggu`
- ✅ **통합 Auth Callback URL**: `https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback`
  - Google과 Kakao 공통 사용

---

## 🎯 필요한 설정 (총 15분 소요)

### 1️⃣ Supabase Dashboard 설정 (5분)

**접속**: https://supabase.com/dashboard
**프로젝트**: `gsiismzchtgdklvdvggu`

#### Google Provider 활성화
1. **Authentication → Providers → Google**
2. **Enable Google** 토글 **ON**
3. 입력:
   - **Client ID**: `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`
   - **Client Secret**: `YOUR_GOOGLE_CLIENT_SECRET`
4. **Save**

#### Kakao Provider 활성화
1. **Authentication → Providers → Kakao**
2. **Enable Kakao** 토글 **ON**
3. 입력:
   - **Client ID**: `81cb1a70b8fe82ca515f645ff77a07d1`
   - **Client Secret**: `B1KNHzoeVAiamo3k8smYfcs2yqMAtpGh`
4. **Save**

> 📝 두 Provider 모두 같은 Callback URL 사용: `https://tlytjitkokavfhwzedml.supabase.co/auth/v1/callback`

---

### 2️⃣ Google Cloud Console 설정 (5분)

**접속**: https://console.cloud.google.com/apis/credentials

1. **OAuth 2.0 Client ID** 선택
   - Client ID: `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`

2. **승인된 JavaScript 원본** 추가:
   ```
   http://localhost:3001
   https://zipcheck.kr
   ```

3. **승인된 리디렉션 URI** 추가:
   ```
   https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback
   http://localhost:3001/auth/callback
   ```

4. **저장**

---

### 3️⃣ Kakao Developers 설정 (5분)

**접속**: https://developers.kakao.com/console/app

1. **앱 선택** (앱 키: `81cb1a70b8fe82ca515f645ff77a07d1`)

2. **앱 설정 → 플랫폼 → Web 플랫폼 추가** (없는 경우):
   ```
   http://localhost:3001
   ```

3. **제품 설정 → 카카오 로그인 → Redirect URI** 등록:
   ```
   https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback
   http://localhost:3001/auth/callback
   ```

4. **카카오 로그인** 활성화 상태 **ON** 확인

5. **제품 설정 → 카카오 로그인 → 동의항목** 설정:
   - ✅ **닉네임** (필수 동의)
   - ✅ **카카오계정(이메일)** (필수 동의) ← **중요!**
   - ✅ **프로필 사진** (선택 동의)

6. **저장**

---

### 4️⃣ Naver Developers 설정 (추가 설정 불필요)

> 💡 Naver는 커스텀 구현이므로 Naver Developers에만 설정하면 됩니다.

**접속**: https://developers.naver.com/apps/#/list

1. **애플리케이션 선택** (Client ID: `9bLVdkmOcivwS7hSdcDb`)

2. **API 설정 → 서비스 URL**:
   ```
   http://localhost:3001
   https://zipcheck.kr
   ```

3. **API 설정 → Callback URL**:
   ```
   http://localhost:3001/auth/naver/callback
   https://zipcheck.kr/auth/naver/callback
   ```

4. **제공 정보 선택**:
   - ✅ 회원 이름
   - ✅ 이메일 주소
   - ✅ 프로필 사진

5. **저장**

---

## 🧪 테스트 방법

### 1️⃣ 브라우저 접속
```
http://localhost:3001
```

### 2️⃣ 로그인 테스트

#### Google 로그인
1. 로그인 모달 → **"구글로 계속하기"** 클릭
2. Google 계정 선택
3. 권한 승인
4. `/auth/callback` → "로그인 성공!" → 홈

#### Kakao 로그인
1. 로그인 모달 → **"카카오로 계속하기"** 클릭
2. 카카오 로그인
3. 동의하고 계속하기
4. `/auth/callback` → "로그인 성공!" → 홈

#### Naver 로그인
1. 로그인 모달 → **"네이버로 계속하기"** 클릭
2. 네이버 로그인
3. `/auth/naver/callback` → FastAPI 토큰 교환 → "로그인 성공!" → 홈

---

## 📊 OAuth 플로우 비교

### Google & Kakao (Supabase)
```
사용자 클릭
→ Supabase OAuth URL 생성
→ Provider 로그인
→ Supabase Callback (https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback)
→ Supabase 토큰 교환 및 세션 생성
→ /auth/callback
→ 세션 확인
→ 홈
```

### Naver (커스텀)
```
사용자 클릭
→ 네이버 OAuth URL 직접 생성
→ 네이버 로그인
→ /auth/naver/callback
→ FastAPI 토큰 교환 (/auth/naver/exchange)
→ Supabase 사용자 생성
→ 홈
```

---

## 🚨 예상 문제 및 해결

### 문제 1: "redirect_uri_mismatch" (Google/Kakao)
**원인**: Redirect URI가 등록되지 않음

**해결**:
- Google: `https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback` 등록 확인
- Kakao: `https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback` 등록 확인

### 문제 2: "Provider not enabled" (Supabase)
**원인**: Supabase Dashboard에서 Provider 미활성화

**해결**:
- Supabase Dashboard → Authentication → Providers
- Google/Kakao **Enable** 토글 ON 확인

### 문제 3: "앱이 검증되지 않음" (Google)
**원인**: Google OAuth 앱 검증 전 상태

**해결**:
- Google Cloud Console → OAuth 동의 화면 → **테스트 사용자 추가**
- 또는 "고급" → "안전하지 않은 페이지로 이동" (개발 중에만)

### 문제 4: "개발 중인 앱" (Kakao)
**원인**: 카카오 앱이 개발 중 상태

**해결**:
- Kakao Developers → **팀 관리** → **팀원 초대**
- 테스트할 카카오 계정을 팀원으로 추가

### 문제 5: "callback_url_mismatch" (Naver)
**원인**: Naver Callback URL 미등록

**해결**:
- Naver Developers → Callback URL
- `http://localhost:3001/auth/naver/callback` 등록 확인

---

## ✅ 설정 완료 체크리스트

### Supabase Dashboard
- [ ] Google Provider 활성화 및 키 입력
- [ ] Kakao Provider 활성화 및 키 입력

### Google Cloud Console
- [ ] JavaScript 원본 2개 등록
- [ ] 리디렉션 URI 2개 등록

### Kakao Developers
- [ ] Web 플랫폼 등록
- [ ] Redirect URI 2개 등록
- [ ] 동의항목 설정 (이메일 필수)
- [ ] 카카오 로그인 활성화

### Naver Developers
- [ ] 서비스 URL 2개 등록
- [ ] Callback URL 2개 등록
- [ ] 제공 정보 선택

---

## 🎯 환경별 Redirect URI 정리

### 개발 환경 (localhost:3001)
| Provider | Redirect URI |
|----------|--------------|
| Google | `https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback` |
| Google | `http://localhost:3001/auth/callback` |
| Kakao | `https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback` |
| Kakao | `http://localhost:3001/auth/callback` |
| Naver | `http://localhost:3001/auth/naver/callback` |

### 프로덕션 (zipcheck.kr)
| Provider | Redirect URI |
|----------|--------------|
| Google | `https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback` |
| Google | `https://zipcheck.kr/auth/callback` |
| Kakao | `https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback` |
| Kakao | `https://zipcheck.kr/auth/callback` |
| Naver | `https://zipcheck.kr/auth/naver/callback` |

---

## 🎉 완료!

설정 완료 후 3가지 소셜 로그인 모두 사용 가능합니다!

**다음 단계**:
1. 로그인 상태 UI 구현
2. 로그아웃 기능 추가
3. 사용자 프로필 페이지
4. 프로덕션 배포

---

## 📚 관련 문서
- `TEST_OAUTH.md` - 상세 테스트 가이드
- `docs/OAUTH_SETUP.md` - 전체 OAuth 설정 문서
- `docs/KAKAO_OAUTH_SETUP.md` - 카카오 전용 가이드
