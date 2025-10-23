# 🟢 네이버 로그인 Supabase Custom OAuth 설정

## 개요

Supabase는 네이버를 기본 Provider로 지원하지 않지만, **Custom OAuth Provider** 기능을 사용하여 네이버를 통합할 수 있습니다.

이렇게 하면:
- ✅ Google/Kakao와 동일한 방식으로 네이버 로그인 구현
- ✅ Supabase가 세션 관리 자동 처리
- ✅ FastAPI 커스텀 구현 불필요

---

## 🔧 1단계: Naver Developers 설정

### 1️⃣ 네이버 애플리케이션 접속
**URL**: https://developers.naver.com/apps/#/list

**앱 정보**:
- Client ID: `9bLVdkmOcivwS7hSdcDb`
- Client Secret: `V7O77vPf_a`

### 2️⃣ Callback URL 등록

**API 설정 → Callback URL**:
```
https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
```

### 3️⃣ 서비스 URL 설정

**API 설정 → 서비스 URL**:
```
http://localhost:3000
https://zipcheck.kr
```

### 4️⃣ 제공 정보 선택
- ✅ 회원 이름
- ✅ 이메일 주소
- ✅ 프로필 사진

---

## 🔧 2단계: Supabase Dashboard 설정

### 1️⃣ Supabase 접속
**URL**: https://supabase.com/dashboard
**프로젝트**: `gsiismzchtgdklvdvggu`

### 2️⃣ Custom OAuth Provider 추가

1. **Authentication → Providers** 이동
2. 스크롤을 아래로 내려서 **"Add a new provider"** 또는 **Custom OAuth** 섹션 찾기
3. **"Enable Custom OAuth Provider"** 클릭

### 3️⃣ 네이버 OAuth 정보 입력

**Provider Name** (필수):
```
naver
```

**Authorization URL**:
```
https://nid.naver.com/oauth2.0/authorize
```

**Token URL**:
```
https://nid.naver.com/oauth2.0/token
```

**User Info URL**:
```
https://openapi.naver.com/v1/nid/me
```

**Client ID** (네이버에서 발급받은 값):
```
9bLVdkmOcivwS7hSdcDb
```

**Client Secret** (네이버에서 발급받은 값):
```
V7O77vPf_a
```

**Scopes** (네이버가 제공하는 정보):
```
name email
```

**Additional Configuration** (선택사항):
- **Redirect URL**: 자동으로 `https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback` 생성됨

### 4️⃣ User Info Mapping (중요!)

네이버 API 응답 구조에 맞게 매핑:

**Email Path** (JSON path to email):
```
response.email
```

**Name Path** (JSON path to name):
```
response.name
```

**Avatar Path** (JSON path to profile picture):
```
response.profile_image
```

**ID Path** (JSON path to unique user ID):
```
response.id
```

> 💡 네이버 User Info API는 `{ resultcode: "00", response: { id, email, name, ... } }` 형태로 응답합니다.

### 5️⃣ 저장
**Save** 또는 **Update** 버튼 클릭

---

## 🔧 3단계: 프론트엔드 코드 수정

### 기존 코드 (커스텀 구현)
```typescript
// 삭제할 코드
const state = Math.random().toString(36).substring(2, 15);
sessionStorage.setItem("naver_oauth_state", state);
const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?...`;
window.location.href = naverAuthUrl;
```

### 새로운 코드 (Supabase 통합)
```typescript
// Supabase를 통한 네이버 로그인
const { error } = await supabase.auth.signInWithOAuth({
  provider: "naver", // Supabase에서 설정한 Custom Provider 이름
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});

if (error) {
  console.error("Naver 로그인 오류:", error);
  alert(`로그인 실패: ${error.message}`);
}
```

---

## 📝 네이버 User Info API 응답 구조

네이버 `/v1/nid/me` API는 다음과 같은 JSON을 반환합니다:

```json
{
  "resultcode": "00",
  "message": "success",
  "response": {
    "id": "32742776",
    "email": "user@example.com",
    "name": "홍길동",
    "nickname": "홍길동",
    "profile_image": "https://ssl.pstatic.net/...",
    "age": "30-39",
    "gender": "M",
    "birthday": "10-01",
    "birthyear": "1990",
    "mobile": "010-1234-5678"
  }
}
```

Supabase는 `response.*` 경로로 필요한 정보를 추출합니다.

---

## 🧪 테스트 방법

### 1️⃣ 코드 수정 후 서버 재시작

### 2️⃣ 브라우저 테스트
1. http://localhost:3000 접속
2. 로그인 모달 열기
3. **"네이버로 계속하기"** 클릭
4. 네이버 로그인 완료
5. `/auth/callback`으로 리디렉션
6. 세션 자동 생성 확인

### 3️⃣ 세션 확인
```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('Provider:', session?.user.app_metadata.provider); // "naver"
console.log('Email:', session?.user.email);
```

---

## ✅ 장점

### 커스텀 구현 대비 Supabase Custom OAuth 장점

| 항목 | 커스텀 구현 | Supabase Custom OAuth |
|------|-------------|----------------------|
| 코드 복잡도 | 높음 (FastAPI 백엔드 필요) | 낮음 (Supabase가 처리) |
| 세션 관리 | 수동 구현 필요 | 자동 처리 |
| 토큰 교환 | 직접 구현 | Supabase가 처리 |
| CSRF 보호 | 직접 구현 | Supabase가 처리 |
| 일관성 | Google/Kakao와 다름 | 모두 동일한 방식 |
| 유지보수 | 어려움 | 쉬움 |

---

## 🚨 주의사항

### 1️⃣ Provider Name 일치
Supabase Dashboard에서 설정한 **Provider Name**과 코드의 `provider` 값이 정확히 일치해야 합니다:

```typescript
// Dashboard에서 Provider Name을 "naver"로 설정했다면
provider: "naver" // ✅ 정확히 일치

// 대소문자도 구분됩니다
provider: "Naver" // ❌ 오류
```

### 2️⃣ User Info Mapping 정확성
네이버 API 응답 구조(`response.email`, `response.name` 등)를 정확히 입력해야 사용자 정보가 올바르게 저장됩니다.

### 3️⃣ Callback URL 등록
네이버 Developers에 Supabase Callback URL을 정확히 등록해야 합니다:
```
https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback
```

---

## 📋 체크리스트

### Naver Developers
- [ ] Callback URL: `https://gsiismzchtgdklvdvggu.supabase.co/auth/v1/callback` 등록
- [ ] Callback URL: `http://localhost:3000/auth/callback` 등록
- [ ] 서비스 URL: `http://localhost:3000`, `https://zipcheck.kr` 등록
- [ ] 제공 정보: 이름, 이메일, 프로필 사진 선택

### Supabase Dashboard
- [ ] Custom OAuth Provider 추가
- [ ] Provider Name: `naver` 입력
- [ ] Authorization/Token/User Info URL 입력
- [ ] Client ID/Secret 입력
- [ ] Scopes: `name email` 입력
- [ ] User Info Mapping 설정:
  - Email Path: `response.email`
  - Name Path: `response.name`
  - Avatar Path: `response.profile_image`
  - ID Path: `response.id`
- [ ] 저장

### 프론트엔드 코드
- [ ] `LoginModal.tsx`에서 네이버 로그인 코드를 Supabase 방식으로 수정
- [ ] `/auth/naver/callback` 페이지 삭제 (이제 `/auth/callback` 공통 사용)
- [ ] FastAPI `/auth/naver/exchange` 엔드포인트 제거 (불필요)

---

## 🎯 다음 단계

Custom OAuth 설정 완료 후:
1. 3가지 소셜 로그인 모두 Supabase 통합 완료
2. 일관된 로그인 플로우
3. 간소화된 코드베이스
4. 프로덕션 배포 준비

---

## 📚 참고 자료
- [Supabase Custom OAuth 문서](https://supabase.com/docs/guides/auth/social-login/auth-custom)
- [네이버 로그인 API 문서](https://developers.naver.com/docs/login/api/)
