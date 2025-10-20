# 프론트엔드-백엔드 협업 가이드

## 📋 현재 상태

### ✅ 백엔드 완료 사항 (P0-P1)
- **FastAPI 서버**: 포트 8000에서 실행 가능
- **데이터베이스 스키마**: v2_ prefix 전략으로 완전 설계 완료
- **파일 검증 시스템**: PDF 업로드 보안 검증 완료
- **API 엔드포인트**: `/healthz`, `/ingest`, `/analyze` 구현 완료

### ⏳ 대기 중인 작업
- **Supabase 스키마 적용**: `db/schema_v2.sql` 실행 필요
- **실제 PDF 테스트**: 첫 번째 업로드 테스트
- **P2 작업**: 파싱 개선, 벡터 검색 튜닝, 리포트 저장

---

## 🔌 API 엔드포인트 현황

### 1. 헬스체크 (Health Check)
```http
GET http://localhost:8000/healthz
```

**응답 예시:**
```json
{
  "ok": true,
  "version": "2.0.0",
  "environment": "development"
}
```

**프론트엔드 통합:**
- 서버 상태 확인용
- 페이지 로드 시 백엔드 연결 확인

---

### 2. PDF 업로드 및 벡터화 (Ingest)
```http
POST http://localhost:8000/ingest
Content-Type: multipart/form-data

{
  "file": (PDF 파일),
  "contract_id": "test_001",
  "addr": "서울시 강남구 테헤란로 123",
  "user_id": "00000000-0000-0000-0000-000000000000"  // TODO: JWT에서 자동 추출 예정
}
```

**응답 예시:**
```json
{
  "ok": true,
  "contract_id": "test_001",
  "length": 15234,
  "chunks": 12
}
```

**주요 검증 규칙:**
- 파일 크기: 최대 50MB
- 파일 형식: .pdf만 허용
- MIME 타입: application/pdf만 허용
- contract_id: 영문/숫자/언더스코어/하이픈만 허용 (1-100자)
- 주소: 최대 200자

**에러 응답 예시:**
```json
{
  "detail": "파일 크기가 너무 큽니다: 52.34MB (최대: 50MB)"
}
```

**프론트엔드 통합:**
- 파일 선택 UI 구현
- 업로드 진행률 표시 (선택)
- 성공/실패 메시지 표시
- contract_id 자동 생성 또는 사용자 입력

**주의사항:**
- 현재는 `user_id`를 Form 파라미터로 전달
- 향후 JWT 토큰에서 자동 추출로 변경 예정
- 프론트엔드에서 Supabase Auth 사용 중이면, user.id를 전달

---

### 3. 계약서 분석 (Analyze)
```http
POST http://localhost:8000/analyze
Content-Type: application/json

{
  "question": "이 계약서에서 특약 사항을 알려줘",
  "mode": "single",  // "single" 또는 "consensus"
  "provider": "openai"  // "openai" 또는 "claude" (optional)
}
```

**응답 예시:**
```json
{
  "answer": "검색된 계약서에서 다음과 같은 특약 사항이 발견되었습니다:\n\n1. ...",
  "mode": "single",
  "provider": "openai"
}
```

**mode 설명:**
- `single`: 단일 LLM 모델 사용 (빠름, 저비용)
- `consensus`: 듀얼 LLM 모델 사용 (P3에서 구현 예정)

**provider 설명:**
- `openai`: GPT-4o-mini 사용 (기본값)
- `claude`: Claude Sonnet 사용
- 생략 시 환경 변수 `PRIMARY_LLM` 값 사용

**프론트엔드 통합:**
- 질문 입력 UI 구현
- 스트리밍 응답 표시 (선택)
- 응답 텍스트 마크다운 렌더링
- 로딩 인디케이터

---

## 🗄️ 데이터베이스 스키마 (v2_ prefix)

### 주요 테이블

#### v2_contracts (계약서 메타데이터)
```sql
id          UUID       -- 계약서 내부 ID (PK)
user_id     UUID       -- 사용자 ID (FK: auth.users)
contract_id TEXT       -- 계약서 고유 ID (사용자 정의)
addr        TEXT       -- 부동산 주소
status      TEXT       -- 'processing', 'completed', 'failed'
created_at  TIMESTAMP
updated_at  TIMESTAMP
```

#### v2_documents (문서 원본 및 텍스트)
```sql
id           UUID       -- 문서 ID (PK)
contract_id  UUID       -- 계약서 ID (FK: v2_contracts)
user_id      UUID       -- 사용자 ID
file_name    TEXT       -- 파일명
file_path    TEXT       -- 임시 파일 경로
file_size    INTEGER    -- 파일 크기 (bytes)
mime_type    TEXT       -- MIME 타입
text         TEXT       -- 추출된 텍스트
text_length  INTEGER    -- 텍스트 길이
created_at   TIMESTAMP
```

#### v2_embeddings (벡터 임베딩)
- pgvector 확장 사용
- IVFFlat 인덱스로 유사도 검색

#### v2_reports (분석 리포트)
```sql
id           UUID       -- 리포트 ID (PK)
contract_id  UUID       -- 계약서 ID (FK: v2_contracts)
user_id      UUID       -- 사용자 ID
result_json  JSONB      -- 분석 결과 (JSON)
result_text  TEXT       -- 분석 결과 (텍스트)
created_at   TIMESTAMP
```

### RLS (Row Level Security)
- 모든 v2_ 테이블에 RLS 정책 적용
- 사용자는 자신의 데이터만 접근 가능
- 정책 조건: `user_id = auth.uid()`

---

## 🔐 환경 변수 설정

### 백엔드 (.env)
```env
# Supabase (프론트엔드와 동일한 Supabase 사용)
DATABASE_URL=postgresql://postgres:x9HLz4pQVTDzaS3w@db.gsiismzchtgdklvdvggu.supabase.co:5432/postgres

# LLM API Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# LLM 설정
PRIMARY_LLM=openai
JUDGE_LLM=claude
EMBED_MODEL=text-embedding-3-large

# 선택 사항
SENTRY_DSN=your_sentry_dsn
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
```

### 프론트엔드 (.env.local)
```env
# Next.js
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase (이미 설정됨)
NEXT_PUBLIC_SUPABASE_URL=https://gsiismzchtgdklvdvggu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_EGdqKePDQ2veJd13aheY8w_Mn6WMqmx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_mWrf_bxAOf0Q0UP5GYg_Sg_GaixqH8B

# FastAPI 백엔드 URL
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:8000
```

---

## 📝 Supabase 스키마 적용 절차

### 1단계: pgvector 확장 활성화
1. Supabase 대시보드 → SQL Editor
2. 다음 SQL 실행:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2단계: v2 스키마 적용
1. `db/schema_v2.sql` 파일 열기
2. 전체 내용 복사
3. SQL Editor에 붙여넣기
4. **Run** 클릭

### 3단계: 적용 확인
```sql
-- 테이블 생성 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'v2_%';

-- 예상 결과: 5개 테이블
-- v2_profiles, v2_contracts, v2_documents, v2_embeddings, v2_reports
```

```sql
-- RLS 활성화 확인
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'v2_%';

-- 모든 v2_ 테이블의 rowsecurity가 true여야 함
```

---

## 🧪 테스트 시나리오

### 1. 백엔드 헬스체크
```bash
curl http://localhost:8000/healthz
```

### 2. PDF 업로드 테스트
```bash
curl -X POST http://localhost:8000/ingest \
  -F "file=@sample_contract.pdf" \
  -F "contract_id=test_001" \
  -F "addr=서울시 강남구 테헤란로 123" \
  -F "user_id=00000000-0000-0000-0000-000000000000"
```

### 3. DB 확인
```sql
-- contracts 테이블 확인
SELECT * FROM v2_contracts WHERE contract_id = 'test_001';

-- documents 테이블 확인
SELECT id, contract_id, file_name, text_length
FROM v2_documents
WHERE contract_id IN (
    SELECT id FROM v2_contracts WHERE contract_id = 'test_001'
);
```

### 4. 분석 테스트
```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "question": "이 계약서의 특약 사항을 알려줘",
    "mode": "single",
    "provider": "openai"
  }'
```

---

## 🚧 향후 작업 계획 (P2)

### 2-1. 파싱 개선
- 페이지별 메타데이터 포함
- OCR 전략 개선
- 에러 처리 강화

### 2-2. 벡터 검색 튜닝
- Retriever 파라미터 최적화
- MMR (Maximal Marginal Relevance) 테스트

### 2-3. 리포트 저장 및 조회
- `v2_reports` 테이블에 분석 결과 저장
- `GET /reports/{id}` 엔드포인트 구현
- 리포트 히스토리 조회 기능

---

## 🤝 협업 체크리스트

### 백엔드 담당
- [x] P0 완료 (FastAPI 서버 부팅)
- [x] P1 완료 (DB 스키마 + 파일 검증)
- [ ] Supabase 스키마 적용 (프론트엔드와 협업)
- [ ] 첫 PDF 업로드 테스트
- [ ] P2 작업 시작

### 프론트엔드 담당
- [ ] Supabase 스키마 적용 (SQL Editor에서 실행)
- [ ] 환경 변수 추가 (`NEXT_PUBLIC_AI_SERVICE_URL`)
- [ ] `/ingest` API 호출 구현
- [ ] `/analyze` API 호출 구현
- [ ] 에러 핸들링 구현

---

## 📞 문제 해결

### 문제 1: CORS 에러
**증상**: 프론트엔드에서 API 호출 시 CORS 에러 발생

**해결책**:
- 백엔드 `app.py`에 CORS 미들웨어 설정 확인
- 현재 설정: `allow_origins=["*"]` (개발 환경)
- 프로덕션에서는 특정 도메인만 허용

### 문제 2: 파일 업로드 실패
**증상**: PDF 업로드 시 400/500 에러

**확인 사항**:
- 파일 크기 (최대 50MB)
- 파일 확장자 (.pdf)
- MIME 타입 (application/pdf)
- contract_id 형식 (영문/숫자/언더스코어/하이픈만)

### 문제 3: DB 연결 실패
**증상**: `DATABASE_URL` 연결 오류

**확인 사항**:
- Supabase 프로젝트 URL 확인
- 비밀번호 정확성 확인
- pgvector 확장 활성화 여부

---

## 📚 참고 문서

- [CLAUDE.md](CLAUDE.md) - 프로젝트 전체 가이드
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - 프로젝트 진행 상태
- [services/ai/P1_COMPLETION.md](services/ai/P1_COMPLETION.md) - P1 완료 보고서
- [db/README.md](db/README.md) - 데이터베이스 설정 가이드
- [services/ai/api/openapi.yaml](services/ai/api/openapi.yaml) - API 스펙

---

**마지막 업데이트**: 2024-10-17
**백엔드 상태**: P0-P1 완료 ✅
**다음 단계**: Supabase 스키마 적용 → PDF 테스트 → P2 시작
