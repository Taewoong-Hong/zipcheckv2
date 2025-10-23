# 🔗 백엔드 연동 가이드

프론트엔드와 백엔드 API 연결 설정 가이드입니다.

## 📍 현재 포트 구성

- **프론트엔드 (Next.js)**: http://localhost:3002
- **백엔드 (FastAPI)**: http://localhost:3001

## ⚙️ 환경 변수 설정

### 1. `.env.local` 파일 생성

**위치**: `apps/web/.env.local`

```bash
# AI API (백엔드 FastAPI 서버)
AI_API_URL=http://localhost:3001

# NextAuth (소셜 로그인)
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=your-secret-key-here

# Supabase (사용자 데이터베이스)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# OAuth Providers
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_CLIENT_SECRET=your-kakao-client-secret

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret
```

## 🔄 API 프록시 동작 방식

### 현재 설정
**파일**: [apps/web/app/api/ai/[...path]/route.ts](./app/api/ai/[...path]/route.ts)

```typescript
const AI_API_URL = process.env.AI_API_URL || 'http://localhost:8000';
```

### 요청 흐름
```
클라이언트 → Next.js (3002) → FastAPI (3001)
  /api/ai/*          프록시          백엔드 API
```

### 예시
```typescript
// 프론트엔드에서 호출
fetch('/api/ai/analyze', {
  method: 'POST',
  body: JSON.stringify({ question: "계약서 분석해줘" }),
});

// 실제 요청
// http://localhost:3002/api/ai/analyze
//   ↓ 프록시
// http://localhost:3001/analyze
```

## 🧪 백엔드 연결 테스트

### 1. 백엔드 서버 확인
```bash
curl http://localhost:3001/healthz
```

**예상 응답**:
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

### 2. 프론트엔드에서 테스트
브라우저 콘솔에서:
```javascript
fetch('/api/ai/healthz')
  .then(res => res.json())
  .then(data => console.log(data));
```

## 🐛 문제 해결

### 1. CORS 오류
**증상**: `Access-Control-Allow-Origin` 오류

**해결**: FastAPI에 CORS 미들웨어 추가
```python
# services/ai/app.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. 연결 거부 오류
**증상**: `ECONNREFUSED` 또는 `502 Bad Gateway`

**원인**: 백엔드 서버가 실행되지 않음

**해결**:
```bash
cd services/ai
python app.py
# 또는
uvicorn app:app --host 0.0.0.0 --port 3001 --reload
```

### 3. 환경 변수 인식 안됨
**증상**: API 호출이 `http://localhost:8000`로 전송됨

**해결**:
1. `.env.local` 파일 생성 확인
2. Next.js 개발 서버 재시작
```bash
# 개발 서버 종료 (Ctrl+C)
cd apps/web
npm run dev
```

### 4. 포트 충돌
**증상**: `Port 3002 is already in use`

**해결**:
```bash
# Windows
netstat -ano | findstr :3002
taskkill /F /PID <PID>

# 또는 다른 포트 사용
PORT=3003 npm run dev
```

## 🔐 보안 고려사항

### 개발 환경
- `.env.local`은 `.gitignore`에 포함됨 (커밋 안됨)
- 로컬 개발 시에만 사용하는 테스트 키 사용

### 프로덕션 환경
- 환경 변수는 호스팅 플랫폼에서 설정
- 실제 API 키와 시크릿 사용
- HTTPS 필수

## 📝 API 엔드포인트 목록

### 현재 구현된 엔드포인트

#### 1. 채팅 분석
**URL**: `/api/ai/analyze`
**Method**: `POST`
**Body**:
```json
{
  "question": "계약서 분석해줘"
}
```

**응답**:
```json
{
  "answer": "AI 분석 결과..."
}
```

#### 2. 파일 업로드
**URL**: `/api/ai/ingest`
**Method**: `POST`
**Body**: `multipart/form-data`
```
file: (PDF 파일)
contract_id: "계약서 ID"
addr: "주소"
```

**응답**:
```json
{
  "ok": true,
  "contract_id": "abc123",
  "length": 12345
}
```

## 🚀 다음 단계

### 백엔드 담당자
1. [ ] FastAPI 서버를 3001 포트에서 실행
2. [ ] `/healthz` 엔드포인트 구현
3. [ ] CORS 미들웨어 설정
4. [ ] `/analyze`, `/ingest` 엔드포인트 구현

### 프론트엔드 담당자
1. [ ] `.env.local` 파일 생성
2. [ ] `AI_API_URL=http://localhost:3001` 설정
3. [ ] 개발 서버 재시작
4. [ ] 브라우저에서 연결 테스트

## 📞 연락처

문제 발생 시:
1. 백엔드 서버 로그 확인
2. 프론트엔드 개발자 도구 (F12) → Console/Network 탭 확인
3. 터미널 에러 메시지 공유

---

## 🔄 업데이트 로그

- **2025-01-20**: 초기 작성
- **포트 변경**: 8000 → 3001 (백엔드 담당자 요청)
