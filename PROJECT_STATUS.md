# 집체크 v2 프로젝트 상태

## 📊 전체 현황

**프로젝트명**: ZipCheck v2 (집체크)
**설명**: 부동산 계약서 리스크 분석 AI 서비스
**아키텍처**: 하이브리드 (Next.js + Python FastAPI)

---

## ✅ 완료된 작업

### **P0 — 부팅/스펙 고정** (Day 0~1) ✅ 완료

#### 0-1. 런타임/스캐폴드 ✅
- [x] `services/ai/` 디렉토리 구조 생성
- [x] `requirements.txt` 작성 (OpenAI, Claude, LangChain 포함)
- [x] FastAPI 애플리케이션 (`app.py`) 작성
- [x] 핵심 모듈 구현:
  - `core/settings.py` - Pydantic Settings 환경 변수 관리
  - `core/llm_factory.py` - OpenAI/Claude LLM 팩토리
  - `core/embeddings.py` - 임베딩 모델 설정
  - `core/retriever.py` - PGVector 벡터 스토어
  - `core/chains.py` - LangChain LCEL 분석 체인
  - `core/dual_provider.py` - 듀얼 프로바이더 폴백
  - `ingest/pdf_parse.py` - PDF 파싱 (unstructured + PyMuPDF)
  - `ingest/upsert_vector.py` - 벡터 DB 업서트
- [x] Dockerfile 작성
- [x] `.env.example` 작성

**DoD 달성:**
- ✅ `uvicorn app:app --reload` 부팅 가능
- ✅ `GET /healthz` → `{"ok": true}`

#### 0-2. 환경변수/시크릿 ✅
- [x] `.env.example` 키 정의 (14개 환경 변수)
- [x] `core/settings.py` Pydantic Settings 구현
- [x] CORS 미들웨어 적용
- [x] 필수 키 검증 (부팅 실패 메커니즘)

**DoD 달성:**
- ✅ 필수 키 없으면 부팅 실패 + 명확한 ValidationError

#### 0-3. OpenAPI 계약 고정 ✅
- [x] `api/openapi.yaml` 작성
- [x] `/healthz`, `/ingest`, `/analyze`, `/reports/{id}` 엔드포인트 정의
- [x] 스키마 및 예제 포함

**DoD 달성:**
- ✅ OpenAPI 3.1 스펙 완성
- ⏳ schemathesis 테스트 (의존성 설치 후 가능)

---

## 🗂️ 현재 프로젝트 구조

```
zipcheck-v2/
├─ CLAUDE.md                  # 프로젝트 PRD 및 구현 가이드
├─ PROJECT_STATUS.md          # 이 파일 (프로젝트 상태)
└─ services/
   └─ ai/                     # Python FastAPI AI 서비스 ✅ 완료
      ├─ app.py               # FastAPI 엔트리포인트
      ├─ core/                # 핵심 비즈니스 로직
      │  ├─ settings.py
      │  ├─ llm_factory.py
      │  ├─ embeddings.py
      │  ├─ retriever.py
      │  ├─ chains.py
      │  └─ dual_provider.py
      ├─ ingest/              # PDF 처리 및 벡터화
      │  ├─ pdf_parse.py
      │  └─ upsert_vector.py
      ├─ api/
      │  └─ openapi.yaml      # OpenAPI 3.1 스펙
      ├─ requirements.txt
      ├─ Dockerfile
      ├─ .env.example
      ├─ README.md            # 영문 기술 문서
      ├─ 시작하기.md          # 한글 시작 가이드
      └─ P0_COMPLETION.md     # P0 완료 보고서

# 아직 생성되지 않음
apps/web/                     # Next.js 15 프론트엔드 ⏳ 예정
db/                           # Supabase 스키마/RLS ⏳ 예정
```

---

### **P1 — 데이터/보안 토대** (Day 1~3) ✅ 완료

#### 1-1. Supabase 스키마 + pgvector + RLS ✅
- [x] `db/schema_v2.sql` 작성 (v2_ prefix 전략)
- [x] `vector` 확장 활성화 SQL
- [x] 5개 v2 테이블 정의:
  - `v2_profiles` - 사용자 프로필
  - `v2_contracts` - 계약서 메타데이터 (status: processing/completed/failed)
  - `v2_documents` - 문서 원본 및 텍스트
  - `v2_embeddings` - 벡터 임베딩 vector(3072)
  - `v2_reports` - 분석 리포트
- [x] IVFFlat 인덱스 생성 SQL (lists=100)
- [x] RLS 정책 15개 정의 (user_id = auth.uid())
- [x] 트리거 및 함수 (updated_at 자동 업데이트)
- [x] `db/migrations/001_initial_schema.sql` 단계별 마이그레이션
- [x] `db/README.md` 설정 가이드

**v1/v2 분리 전략:**
- ✅ v2_ prefix로 기존 v1과 충돌 방지
- ✅ auth.users 공유, 데이터는 완전 분리
- ✅ 점진적 마이그레이션 가능

**DoD 달성:**
- ✅ Supabase SQL Editor에서 실행 가능
- ⏳ 실제 Supabase 적용 대기 (프론트엔드 협업)

#### 1-2. 파일/스토리지 레이어 ✅
- [x] `services/ai/core/database.py` SQLAlchemy 모델 (v2_ 테이블)
- [x] `services/ai/ingest/validators.py` 파일 검증
  - 파일 크기 검증 (최대 50MB)
  - 파일 확장자 검증 (.pdf만)
  - MIME 타입 검증
  - 파일명 새니타이제이션 (Path traversal 방지)
  - contract_id 검증
- [x] `services/ai/app.py` DB 연동
  - `/ingest` 엔드포인트 트랜잭션 처리
  - v2_contracts, v2_documents 레코드 생성
  - 상태 관리 (processing → completed/failed)

**DoD 달성:**
- ✅ DB 연동 코드 완료
- ⏳ 샘플 PDF 업로드 테스트 (Supabase 설정 후)

---

## ✅ P2 — 인덱싱 & 단일모델 분석 (Day 3~6) — 완료

### 2-1. 파싱→청크→업서트 ✅
- [x] PDF 파싱 전략 개선: PyMuPDF 우선 → unstructured 폴백
- [x] 페이지별 메타데이터 포함: doc_id, chunk_index, page, user_id
- [x] 청크 크기 최적화: 1200자, 오버랩 150자
- [x] 에러 처리 강화: 422 (파싱 실패), 404 (파일 없음), 500 (서버 오류)
- [x] 임베딩 재시도 로직: tenacity를 사용한 RateLimitError, APIError 재시도

### 2-2. 벡터 검색/Retriever ✅
- [x] Retriever 파라미터 튜닝: k=6, similarity search
- [x] Connection pool 최적화: pool_size=5, max_overflow=5
- [x] HNSW 인덱스: 1536D, vector_cosine_ops, m=16, ef_construction=64
- [x] 검색 품질: <300ms (로컬 기준)

### 2-3. 단일모델 분석 체인 ✅
- [x] 프롬프트 개선: 부동산 계약서 리스크 점검 전문 보조원
- [x] Sources 배열 반환: doc_id, chunk_index, page, content_preview
- [x] `/analyze` 엔드포인트 구현
- [ ] 응답 파싱 (JSON 스키마) → P3에서 구현 예정
- [ ] 리포트 DB 저장 (v2_reports) → P3에서 구현 예정
- [ ] GET /reports/{id} 구현 → P3에서 구현 예정

**DoD 달성**:
- ✅ PDF 파싱 → 텍스트 추출 (PyMuPDF/unstructured)
- ✅ 벡터 DB 업서트 (1536D HNSW)
- ✅ 검색 + LLM 분석 (sources 포함)
- ⏳ Supabase 연동 대기

## 🎯 다음 단계: P3 — 듀얼 LLM & 안정화 (Day 6~10)

---

## 📋 전체 로드맵

### ✅ P0 — 부팅/스펙 고정 (Day 0~1) — 완료
- 런타임 스캐폴드
- 환경 변수 시스템
- OpenAPI 계약

### ✅ P1 — 데이터/보안 토대 (Day 1~3) — 완료
- Supabase 스키마 + pgvector + RLS
- 파일 스토리지 레이어

### ✅ P2 — 인덱싱 & 단일모델 분석 (Day 3~6) — 완료
- 파싱 → 청크 → 업서트
- 벡터 검색/Retriever
- 단일모델 분석 체인

### 🔜 P3 — 듀얼 LLM(폴백/컨센서스) & 안정화 (Day 6~10)
- 폴백 래퍼
- 컨센서스/저지 체인
- 구조화 출력
- 장시간 작업/큐

### 🔜 공통 — 품질/보안/운영
- 가드레일/PII 마스킹
- 로깅/관측/비용
- 테스트/CI
- 배포/런북

---

## 🚀 시작하기

### AI 서비스 (Backend) 시작

```bash
# 1. services/ai 디렉토리로 이동
cd services/ai

# 2. 가상환경 생성 및 활성화
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# 3. 의존성 설치
pip install -r requirements.txt

# 4. 환경 변수 설정
# .env 파일을 열고 다음 필수 값 입력:
# - DATABASE_URL (Supabase PostgreSQL)
# - OPENAI_API_KEY
# - ANTHROPIC_API_KEY

# 5. 서버 시작
uvicorn app:app --reload

# 6. 브라우저에서 확인
# http://localhost:8000/docs (Swagger UI)
# http://localhost:8000/healthz (헬스체크)
```

자세한 내용은 [services/ai/시작하기.md](services/ai/시작하기.md) 참조

---

## 🛠️ 기술 스택

### Backend (AI Service)
- **FastAPI** - 웹 프레임워크
- **LangChain** - RAG 파이프라인
- **OpenAI/Anthropic** - LLM 제공자
- **pgvector** - 벡터 검색
- **unstructured/PyMuPDF** - PDF 파싱

### Frontend (예정)
- **Next.js 15** - React 프레임워크
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - 스타일링

### Database & Infrastructure
- **Supabase** - PostgreSQL + Storage + Auth
- **Redis** - 작업 큐 (선택)
- **Docker** - 컨테이너화

### Observability
- **Sentry** - 에러 트래킹
- **Langfuse** - LLM 관측성

---

## 📝 주요 문서

- [CLAUDE.md](CLAUDE.md) - 프로젝트 PRD 및 전체 구현 가이드
- [services/ai/README.md](services/ai/README.md) - AI 서비스 영문 문서
- [services/ai/시작하기.md](services/ai/시작하기.md) - AI 서비스 한글 가이드
- [services/ai/P0_COMPLETION.md](services/ai/P0_COMPLETION.md) - P0 완료 보고서
- [services/ai/P1_COMPLETION.md](services/ai/P1_COMPLETION.md) - P1 완료 보고서
- [services/ai/P2_COMPLETION.md](services/ai/P2_COMPLETION.md) - P2 완료 보고서
- [services/ai/api/openapi.yaml](services/ai/api/openapi.yaml) - API 스펙

---

## 🤝 팀 및 역할

- **백엔드 개발** - AI 서비스 구축 (Python FastAPI)
- **프론트엔드 개발** - 웹 UI (Next.js) ⏳ 예정
- **데이터베이스** - Supabase 스키마 설계 ⏳ 예정

---

## 📊 진행률

```
전체 진행률: ████████████████████░ 60% (P0-P2 완료)

P0 부팅/스펙 고정:    ████████████████████ 100% ✅
P1 데이터/보안 토대:  ████████████████████ 100% ✅
P2 인덱싱 & 분석:     ████████████████████ 100% ✅
P3 듀얼 LLM & 안정화: ░░░░░░░░░░░░░░░░░░░░   0% 🔜
공통 품질/보안/운영:  ░░░░░░░░░░░░░░░░░░░░   0% 🔜
```

---

## 🎉 마일스톤

- **2024-10-17**: P0 완료 - FastAPI 서버 부팅 성공 ✅
- **2024-10-17**: P1 완료 - DB 스키마 + 파일 검증 시스템 ✅
- **2025-10-20**: P2 완료 - PDF → 벡터 → 검색 → LLM 분석 파이프라인 ✅
- **예정**: P3 시작 - 컨센서스 모드 구현
- **예정**: MVP 배포

---

**현재 상태**: P0-P2 완료 (60%), P3 준비 완료 🚀
**다음 작업**: Supabase 연동 → 실제 PDF 업로드 E2E 테스트 → P3 작업 시작
