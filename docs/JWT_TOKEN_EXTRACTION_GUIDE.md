# JWT 토큰 추출 가이드 (한국어)

## 📋 목차
1. [브라우저 개발자 도구 열기](#1-브라우저-개발자-도구-열기)
2. [Network 탭 사용법](#2-network-탭-사용법)
3. [JWT 토큰 추출](#3-jwt-토큰-추출)
4. [토큰 검증](#4-토큰-검증)
5. [테스트 스크립트에 토큰 추가](#5-테스트-스크립트에-토큰-추가)

---

## 1. 브라우저 개발자 도구 열기

### Chrome/Edge
```
F12 키 또는 Ctrl + Shift + I
```

### Firefox
```
F12 키 또는 Ctrl + Shift + K
```

### Safari
```
Option + Command + I
```

---

## 2. Network 탭 사용법

1. **Network 탭 선택**
   - 개발자 도구 상단 메뉴에서 "Network" 클릭

2. **필터 설정**
   - "Fetch/XHR" 필터 클릭 (API 요청만 표시)

3. **로그 기록 시작**
   - 빨간 녹화 버튼이 활성화되어 있는지 확인
   - 비활성화되어 있으면 클릭하여 활성화

4. **페이지 새로고침**
   - F5 키 또는 Ctrl + R

---

## 3. JWT 토큰 추출

### 방법 1: API 요청 헤더에서 추출

1. **API 요청 찾기**
   - Network 탭에서 `/api/chat/init` 또는 `/api/chat/message` 요청 찾기
   - 요청 이름 클릭

2. **Request Headers 확인**
   - "Headers" 탭 선택
   - "Request Headers" 섹션 찾기

3. **Authorization 헤더 복사**
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **토큰만 추출**
   - "Bearer " 뒤의 긴 문자열만 복사
   - 예시:
     ```
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
     ```

### 방법 2: Supabase 세션에서 추출

1. **Application/Storage 탭 선택**
   - Chrome: "Application" 탭
   - Firefox: "Storage" 탭

2. **Cookies 확인**
   - "Cookies" → "http://localhost:3000" 선택

3. **Supabase 쿠키 찾기**
   - `sb-<project-ref>-auth-token` 쿠키 찾기
   - Value 열의 값 복사

---

## 4. 토큰 검증

### 토큰 형식 확인
JWT 토큰은 3개 부분으로 구성되며 점(.)으로 구분됩니다:
```
<header>.<payload>.<signature>
```

예시:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ
.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### 토큰 디코딩 (선택사항)
[jwt.io](https://jwt.io)에서 토큰을 디코딩하여 내용 확인:
- `sub`: 사용자 UUID
- `exp`: 토큰 만료 시간 (UNIX timestamp)
- `iat`: 토큰 발급 시간

**⚠️ 주의**: 실제 프로덕션 토큰은 외부 사이트에 입력하지 마세요!

---

## 5. 테스트 스크립트에 토큰 추가

### 방법 1: 직접 코드 수정 (빠른 테스트용)

#### test_regression.py 수정
```python
# Line 168-176 수정 (1. POST /)
await test_endpoint(
    client=client,
    method="POST",
    path="/",
    endpoint_name="1. POST / (simple_chat_analysis)",
    json_data={"question": "전세가율이란 무엇인가요?"},
    headers={"Authorization": "Bearer YOUR_TOKEN_HERE"},  # ✅ 추가
    expected_status=200,  # ✅ 401 → 200 변경
    # skip_reason="인증 토큰 없음 (예상된 401)"  # ✅ 주석 처리
)
```

#### test_performance.py 수정
```python
# Line 219-227 수정 (1. POST /)
await test_endpoint_performance(
    client=client,
    method="POST",
    path="/",
    endpoint_name="1. POST / (simple_chat_analysis)",
    json_data={"question": "전세가율이란 무엇인가요?"},
    headers={"Authorization": "Bearer YOUR_TOKEN_HERE"},  # ✅ 추가
    expected_status=200,  # ✅ 401 → 200 변경
    # skip_reason="인증 토큰 없음 (성능 측정 생략)"  # ✅ 주석 처리
)
```

#### test_sse_streaming.py 수정
```python
# Line 30-34 수정
async with client.stream("GET", url, headers={
    "Accept": "text/event-stream",
    "Authorization": "Bearer YOUR_TOKEN_HERE"  # ✅ 추가
}) as response:
```

**토큰 교체 예시**:
```python
headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"}
```

### 방법 2: 환경변수 사용 (권장)

#### .env 파일 생성
```bash
# services/ai/.env
TEST_JWT_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 테스트 스크립트 수정
```python
import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# 토큰 가져오기
jwt_token = os.getenv("TEST_JWT_TOKEN")

if not jwt_token:
    print("⚠️  경고: TEST_JWT_TOKEN 환경변수가 설정되지 않았습니다.")
    print("    .env 파일에 토큰을 추가하거나 인증 없이 테스트가 스킵됩니다.")
    headers = None
else:
    headers = {"Authorization": f"Bearer {jwt_token}"}

# 테스트 실행
await test_endpoint(
    client=client,
    method="POST",
    path="/",
    endpoint_name="1. POST / (simple_chat_analysis)",
    json_data={"question": "전세가율이란 무엇인가요?"},
    headers=headers,
    expected_status=200 if jwt_token else 401,
)
```

---

## 6. 토큰 만료 시 재발급

JWT 토큰은 일정 시간 후 만료됩니다 (기본값: 1시간).

### 만료 확인
```python
import jwt
from datetime import datetime

token = "YOUR_TOKEN_HERE"

# 토큰 디코딩 (검증 없이)
decoded = jwt.decode(token, options={"verify_signature": False})

# 만료 시간 확인
exp_timestamp = decoded.get("exp")
exp_datetime = datetime.fromtimestamp(exp_timestamp)

print(f"토큰 만료 시간: {exp_datetime}")
print(f"현재 시간: {datetime.now()}")

if datetime.now() > exp_datetime:
    print("❌ 토큰이 만료되었습니다. 다시 로그인하세요.")
else:
    remaining = exp_datetime - datetime.now()
    print(f"✅ 토큰 유효 (남은 시간: {remaining})")
```

### 재발급 방법
1. 프론트엔드에서 로그아웃
2. 다시 로그인
3. 새 토큰 추출
4. 테스트 스크립트 또는 .env 파일 업데이트

---

## 7. 보안 주의사항

### ⚠️ 절대 하지 말아야 할 것
- ❌ JWT 토큰을 Git에 커밋하지 마세요
- ❌ 토큰을 외부 사이트에 공유하지 마세요
- ❌ 프로덕션 토큰을 테스트에 사용하지 마세요
- ❌ 토큰을 슬랙/이메일 등으로 전송하지 마세요

### ✅ 권장 사항
- ✅ .env 파일을 .gitignore에 추가
- ✅ 로컬 개발 환경 전용 계정 사용
- ✅ 토큰 만료 시간 확인
- ✅ 테스트 완료 후 토큰 삭제

---

## 8. 문제 해결

### 401 Unauthorized 에러
```
{
  "detail": "Unauthorized"
}
```

**원인**:
- 토큰이 만료됨
- 토큰 형식이 잘못됨 ("Bearer " 누락)
- 토큰이 유효하지 않음

**해결 방법**:
1. 토큰 형식 확인: `Authorization: Bearer <token>`
2. 토큰 만료 시간 확인
3. 프론트엔드에서 다시 로그인
4. 새 토큰 추출 및 교체

### Network 탭에 요청이 보이지 않음
**해결 방법**:
1. 개발자 도구를 연 상태에서 페이지 새로고침
2. "Preserve log" 옵션 활성화
3. "Fetch/XHR" 필터 확인

### Cookies에 Supabase 토큰이 없음
**해결 방법**:
1. 로그인 상태 확인
2. 브라우저 캐시/쿠키 삭제 후 재로그인
3. 시크릿 모드(Incognito)에서 테스트

---

## 9. 다음 단계

토큰 추출이 완료되었다면:
1. ✅ 3단계 완료: JWT 토큰 획득
2. ⏳ 4단계: 인증을 사용한 실제 테스트 실행
   - test_regression.py 재실행 (실제 API 호출)
   - test_performance.py 재실행 (실제 성능 측정)
   - test_sse_streaming.py 실행 (SSE 스트림 확인)
3. ⏳ 5단계: 예상 결과 및 해석

---

## 10. 참고 자료

- [JWT 공식 문서](https://jwt.io/introduction)
- [Supabase Auth 문서](https://supabase.com/docs/guides/auth)
- [Chrome DevTools Network 가이드](https://developer.chrome.com/docs/devtools/network/)