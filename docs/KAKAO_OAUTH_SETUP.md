# 🟡 Kakao OAuth 설정 가이드

## ✅ 받은 정보
- **Supabase Kakao Callback URL**: `https://tlytjitkokavfhwzedml.supabase.co/auth/v1/callback`
- **Kakao Client ID (REST API 키)**: `81cb1a70b8fe82ca515f645ff77a07d1`
- **Kakao Client Secret**: `B1KNHzoeVAiamo3k8smYfcs2yqMAtpGh`

---

## 🔧 Supabase Dashboard 설정

### 1️⃣ Supabase 접속
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택: **tlytjitkokavfhwzedml** (새 프로젝트)

### 2️⃣ Kakao Provider 활성화
1. 왼쪽 메뉴: **🔒 Authentication** 클릭
2. **Providers** 탭 클릭
3. **Kakao** 찾기
4. **Enable** 토글 **ON**

### 3️⃣ Kakao OAuth 정보 입력

**Client ID (Kakao REST API Key)**:
```
81cb1a70b8fe82ca515f645ff77a07d1
```

**Client Secret (Kakao Client Secret)**:
```
B1KNHzoeVAiamo3k8smYfcs2yqMAtpGh
```

### 4️⃣ 저장
- **Save** 버튼 클릭

---

## 🔧 Kakao Developers 설정

### 1️⃣ Kakao Developers 접속
1. https://developers.kakao.com/console/app 접속
2. 로그인
3. 애플리케이션 선택 (앱 키: `81cb1a70b8fe82ca515f645ff77a07d1`)

### 2️⃣ 플랫폼 설정

**좌측 메뉴 → 앱 설정 → 플랫폼**

#### Web 플랫폼 추가 (없는 경우)
- **플랫폼 추가** → **Web** 선택
- **사이트 도메인** 추가:
  ```
  http://localhost:3001
  ```

### 3️⃣ Redirect URI 설정

**좌측 메뉴 → 제품 설정 → 카카오 로그인**

#### Redirect URI 등록
**Redirect URI** 섹션에서 **등록** 버튼 클릭 후 추가:

```
https://tlytjitkokavfhwzedml.supabase.co/auth/v1/callback
http://localhost:3001/auth/callback
```

> ⚠️ **중요**: Supabase 콜백 URL(`https://tlytjitkokavfhwzedml.supabase.co/auth/v1/callback`)이 가장 중요합니다!

#### 활성화 설정 상태
- **카카오 로그인**: **ON**
- **OpenID Connect**: **OFF** (선택사항)

### 4️⃣ 동의항목 설정

**좌측 메뉴 → 제품 설정 → 카카오 로그인 → 동의항목**

필수 동의항목:
- ✅ **닉네임** (필수 동의)
- ✅ **프로필 사진** (선택 동의)
- ✅ **카카오계정(이메일)** (필수 동의)

> 📝 **이메일은 필수**로 설정해야 사용자 식별이 가능합니다.

### 5️⃣ 저장
- 모든 설정 완료 후 **저장** 클릭

---

## 📝 카카오 로그인 플로우

```
1. 사용자가 "카카오로 계속하기" 클릭
   ↓
2. supabase.auth.signInWithOAuth({ provider: 'kakao' }) 호출
   ↓
3. 카카오 로그인 페이지로 리디렉션
   ↓
4. 사용자 로그인 및 동의 화면
   ↓
5. Supabase 콜백으로 리디렉션
   (https://tlytjitkokavfhwzedml.supabase.co/auth/v1/callback?code=...)
   ↓
6. Supabase가 자동으로 토큰 교환 및 세션 생성
   ↓
7. /auth/callback으로 리디렉션
   ↓
8. 프론트엔드에서 세션 확인
   ↓
9. 홈 페이지로 리디렉션 (로그인 완료)
```

---

## 🧪 테스트 방법

### 1️⃣ 로컬 테스트
1. 브라우저에서 http://localhost:3001 접속
2. 로그인 모달 열기
3. **"카카오로 계속하기"** 클릭
4. 카카오 로그인 페이지에서 로그인
5. 동의 화면에서 **동의하고 계속하기** 클릭
6. `/auth/callback`으로 리디렉션 확인
7. "로그인 성공!" 메시지 확인
8. 홈 페이지로 자동 이동

### 2️⃣ 세션 확인 (브라우저 콘솔)
```javascript
import { supabase } from '@/lib/supabase';

const { data: { session } } = await supabase.auth.getSession();
console.log('User:', session?.user);
console.log('Provider:', session?.user.app_metadata.provider); // "kakao"
console.log('Email:', session?.user.email);
```

---

## 🚨 예상되는 문제 및 해결

### 문제 1: "redirect_uri_mismatch"
**원인**: Kakao Developers에 Redirect URI가 등록되지 않음

**해결**:
```
https://tlytjitkokavfhwzedml.supabase.co/auth/v1/callback
```
위 URL을 Kakao Developers → 카카오 로그인 → Redirect URI에 정확히 등록

### 문제 2: "Invalid client_id"
**원인**: Supabase에 입력한 Client ID가 틀림

**해결**:
- Supabase Dashboard → Authentication → Providers → Kakao
- Client ID 재확인: `81cb1a70b8fe82ca515f645ff77a07d1`

### 문제 3: "이메일 정보를 가져올 수 없습니다"
**원인**: 동의항목에서 이메일이 설정되지 않음

**해결**:
- Kakao Developers → 동의항목
- **카카오계정(이메일)**: **필수 동의**로 변경

### 문제 4: "앱 검수가 필요합니다"
**원인**: 카카오 앱이 개발 중 상태

**해결**:
- **개발 중**에는 **팀원 등록**된 카카오 계정만 로그인 가능
- Kakao Developers → 팀 관리 → 팀원 추가
- 또는 **비즈니스 채널 생성** 후 서비스 오픈 (검수 필요)

---

## ✅ 설정 완료 체크리스트

### Supabase Dashboard
- [ ] Kakao Provider 활성화
- [ ] Client ID 입력: `81cb1a70b8fe82ca515f645ff77a07d1`
- [ ] Client Secret 입력: `B1KNHzoeVAiamo3k8smYfcs2yqMAtpGh`
- [ ] Save 클릭

### Kakao Developers
- [ ] Web 플랫폼 추가 (`http://localhost:3001`)
- [ ] Redirect URI 등록:
  - `https://tlytjitkokavfhwzedml.supabase.co/auth/v1/callback`
  - `http://localhost:3001/auth/callback`
- [ ] 카카오 로그인 활성화 (ON)
- [ ] 동의항목 설정:
  - 닉네임 (필수)
  - 이메일 (필수)
  - 프로필 사진 (선택)
- [ ] 저장

### 코드
- [x] LoginModal.tsx에 카카오 로그인 코드 추가 ✅
- [x] Supabase 클라이언트 설정 완료 ✅

---

## 🎯 다음 단계

카카오 로그인 테스트 완료 후:
1. ✅ Google 로그인 테스트
2. ✅ Naver 로그인 테스트
3. ✅ Kakao 로그인 테스트
4. 프로덕션 Redirect URI 추가 (`https://zipcheck.kr/auth/callback`)
5. 로그인 상태 UI 구현
6. 로그아웃 기능 구현
7. 사용자 프로필 페이지 구현

---

## 📚 참고 자료
- [Kakao Developers 로그인 가이드](https://developers.kakao.com/docs/latest/ko/kakaologin/common)
- [Supabase Kakao OAuth 문서](https://supabase.com/docs/guides/auth/social-login/auth-kakao)
