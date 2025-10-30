# 🔐 ZipCheck 보안 가이드

## 📋 목차
1. [보안 원칙](#보안-원칙)
2. [인증 시스템](#인증-시스템)
3. [RLS 정책](#rls-정책)
4. [Storage 보안](#storage-보안)
5. [환경 변수](#환경-변수)
6. [API 보안](#api-보안)
7. [보안 체크리스트](#보안-체크리스트)

---

## 🎯 보안 원칙

### 핵심 원칙
1. **인증 우선**: 모든 민감한 엔드포인트는 JWT 인증 필수
2. **최소 권한**: 사용자는 자신의 데이터만 접근 가능 (RLS)
3. **서명 URL 사용**: 파일 업로드/다운로드는 짧은 만료 시간의 서명 URL
4. **환경 변수 검증**: 시작 시 모든 필수 설정 검증
5. **Service Role 격리**: Service Role Key는 백엔드에서만 사용

### 절대 금지 사항
- ❌ **프론트엔드에서 Service Role Key 사용**
- ❌ **공개 Storage 버킷 사용**
- ❌ **RLS 비활성화 상태로 배포**
- ❌ **환경 변수를 코드에 하드코딩**
- ❌ **민감한 정보를 로그에 출력**

---

## 🔑 인증 시스템

### JWT 기반 인증 플로우

```
1. 프론트엔드: Supabase Auth 로그인 → JWT 획득
2. 프론트엔드: API 요청 시 Authorization 헤더에 JWT 포함
3. 백엔드: JWT 검증 (JWKS 공개키로 RS256 검증)
4. 백엔드: user_id 추출 및 RLS 적용
```

### FastAPI 인증 사용 예시

#### 1. 인증 필수 엔드포인트
```python
from fastapi import Depends
from core.auth import get_current_user

@app.post("/documents")
async def create_document(user: dict = Depends(get_current_user)):
    user_id = user["sub"]  # Supabase user_id (UUID)
    email = user["email"]
    # ... 로직
```

#### 2. 선택적 인증 엔드포인트
```python
from core.auth import get_optional_user

@app.get("/public/info")
async def public_info(user: dict = Depends(get_optional_user)):
    if user:
        return {"message": f"Welcome, {user['email']}"}
    return {"message": "Welcome, guest"}
```

#### 3. 관리자 전용 엔드포인트
```python
from core.auth import require_admin

@app.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    # 관리자만 접근 가능
    pass
```

### 프론트엔드에서 JWT 전송

```typescript
// Next.js 예시
import { supabase } from '@/lib/supabase';

async function callAPI() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('https://api.zipcheck.kr/documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ... }),
  });

  return response.json();
}
```

---

## 🛡️ RLS 정책

### 활성화된 테이블

#### v2_documents
```sql
-- 사용자는 자신의 문서만 조회/생성/수정/삭제
CREATE POLICY "Users can view own documents"
ON v2_documents FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own documents"
ON v2_documents FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 관리자는 모든 문서 조회 가능
CREATE POLICY "Admins can view all documents"
ON v2_documents FOR SELECT
USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);
```

#### v2_embeddings
```sql
-- 문서 소유자만 임베딩 접근 가능
CREATE POLICY "Users can view embeddings of own documents"
ON v2_embeddings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM v2_documents
  WHERE v2_documents.id = v2_embeddings.doc_id
  AND v2_documents.user_id = auth.uid()
));
```

#### v2_reports
```sql
-- 사용자는 자신의 보고서만 접근
CREATE POLICY "Users can view own reports"
ON v2_reports FOR SELECT
USING (auth.uid() = user_id);
```

### RLS 검증 쿼리
```sql
-- RLS 활성화 확인
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'v2_%';

-- 정책 확인
SELECT tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'v2_%';
```

---

## 📁 Storage 보안

### 파일 경로 구조
```
documents/{user_id}/{doc_id}/{filename}

예시:
documents/550e8400-e29b-41d4-a716-446655440000/abc123/계약서.pdf
```

### Storage 정책
```sql
-- 사용자는 자신의 폴더에만 파일 업로드
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 사용자는 자신의 파일만 조회
CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### 서명 URL 사용 (권장)

#### 파일 업로드
```python
from core.storage import create_signed_upload_url

# 1. 프론트엔드에서 서명 URL 요청
@app.post("/documents/upload-url")
async def get_upload_url(
    doc_id: str,
    filename: str,
    user: dict = Depends(get_current_user)
):
    user_id = user["sub"]
    result = create_signed_upload_url(user_id, doc_id, filename)
    return result  # {"upload_url": "...", "token": "..."}

# 2. 프론트엔드에서 서명 URL로 직접 업로드
# fetch(upload_url, { method: 'PUT', body: file })
```

#### 파일 다운로드
```python
from core.storage import create_signed_download_url

@app.get("/documents/{doc_id}/download")
async def download_document(
    doc_id: str,
    user: dict = Depends(get_current_user)
):
    user_id = user["sub"]
    file_path = f"{user_id}/{doc_id}/document.pdf"

    # 5분 만료 서명 URL 생성
    signed_url = create_signed_download_url(file_path, expires_in=300)

    return {"download_url": signed_url}
```

---

## 🔧 환경 변수

### 필수 환경 변수

#### Backend (.env)
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # ⚠️ 백엔드 전용
JWT_SECRET=your-jwt-secret  # Edge Function과 공통 사용
DATABASE_URL=postgresql://...

# OpenAI
OPENAI_API_KEY=sk-...

# App
APP_ENV=production
LOG_LEVEL=INFO
ALLOWED_ORIGINS=https://zipcheck.kr

# Security
MAX_FILE_SIZE=52428800  # 50MB
RATE_LIMIT_PER_MINUTE=60
```

#### Frontend (.env.local)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # ⚠️ Anon Key만 사용

# API
NEXT_PUBLIC_API_URL=https://api.zipcheck.kr

# ⚠️ 절대 포함하지 말 것:
# - SUPABASE_SERVICE_ROLE_KEY
# - OPENAI_API_KEY
# - DATABASE_URL
```

### 환경 변수 검증
```python
from core.config import validate_environment

# 애플리케이션 시작 시 검증
validate_environment()
```

---

## 🔒 API 보안

### CORS 설정
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # 개발
        "https://zipcheck.kr",     # 프로덕션
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

### Rate Limiting
```python
# TODO: 프로덕션 배포 시 구현
# - Redis 기반 Rate Limiting
# - IP별 요청 제한
# - 사용자별 요청 제한
```

### 입력 검증
```python
from pydantic import BaseModel, Field, validator

class AnalyzeRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)

    @validator("question")
    def validate_question(cls, v):
        if len(v.strip()) < 1:
            raise ValueError("질문은 최소 1자 이상이어야 합니다")
        return v
```

---

## ✅ 보안 체크리스트

### 배포 전 필수 확인사항

#### 데이터베이스
- [ ] 모든 테이블에 RLS 활성화
- [ ] 정책이 올바르게 설정됨
- [ ] 관리자 계정만 is_admin 메타데이터 보유
- [ ] 테스트 데이터 제거

#### Storage
- [ ] documents 버킷이 비공개(private)로 설정
- [ ] Storage 정책이 활성화됨
- [ ] 파일 크기 제한 설정 (50MB)
- [ ] 허용 MIME 타입 제한

#### Backend
- [ ] Service Role Key가 환경 변수로 관리
- [ ] JWT 검증이 모든 인증 엔드포인트에 적용
- [ ] CORS가 프로덕션 도메인으로 제한
- [ ] 환경 변수 검증 활성화
- [ ] 민감한 정보가 로그에 출력되지 않음

#### Frontend
- [ ] Service Role Key가 절대 포함되지 않음
- [ ] Anon Key만 사용
- [ ] API 요청에 JWT 포함
- [ ] 환경 변수가 NEXT_PUBLIC_ 접두사로 노출 제어

#### 일반
- [ ] HTTPS 강제 사용
- [ ] 최신 보안 패치 적용
- [ ] 의존성 취약점 스캔 완료
- [ ] Sentry 등 에러 모니터링 설정

---

## 🚨 보안 사고 대응

### Service Role Key 노출 시
1. **즉시 Supabase Dashboard에서 Service Role Key 재발급**
2. **모든 배포 환경의 환경 변수 업데이트**
3. **Git 히스토리에서 키 제거 (BFG Repo-Cleaner 사용)**
4. **사용자에게 비밀번호 변경 안내 (필요 시)**

### 의심스러운 활동 감지 시
1. **Supabase Dashboard에서 Auth 로그 확인**
2. **비정상적인 API 요청 패턴 분석**
3. **해당 사용자 계정 일시 정지**
4. **관련 데이터 감사 (RLS 로그)**

---

## 📚 추가 자료

- [Supabase RLS 공식 문서](https://supabase.com/docs/guides/auth/row-level-security)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://curity.io/resources/learn/jwt-best-practices/)

---

**마지막 업데이트**: 2025-01-24
**작성자**: ZipCheck 개발팀
