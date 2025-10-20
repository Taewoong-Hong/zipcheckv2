# P1 완료 보고서 — 데이터/보안 토대

## ✅ 완료된 작업

### 1-1. Supabase 스키마 + pgvector + RLS

**작업 내역:**
- ✅ `db/schema_v2.sql` 작성 (v2_ prefix 전략)
  - pgvector 확장 활성화
  - 5개 v2 테이블 생성: `v2_profiles`, `v2_contracts`, `v2_documents`, `v2_embeddings`, `v2_reports`
  - IVFFlat 인덱스 생성 (벡터 유사도 검색)
  - RLS 정책 설정 (user_id 기반 접근 제어)
  - 트리거 및 함수 (updated_at 자동 업데이트)

- ✅ `db/migrations/001_initial_schema.sql` 작성
  - 단계별 마이그레이션 스크립트
  - 15단계로 분리하여 실행 가능

- ✅ `db/README.md` 작성
  - Supabase 설정 방법
  - pgvector 확장 활성화 가이드
  - 스키마 적용 절차
  - RLS 테스트 방법
  - 문제 해결 가이드

**DoD 달성:**
- ✅ v2_ prefix로 기존 v1 테이블과 완전 분리
- ✅ 5개 테이블 정의 완료
- ✅ pgvector 확장 SQL 포함
- ✅ IVFFlat 인덱스 SQL 포함 (lists=100)
- ✅ RLS 정책 SQL 포함 (user_id = auth.uid())
- ✅ Supabase SQL Editor에서 실행 가능한 형식

**테이블 구조:**
```sql
v2_profiles      - 사용자 프로필
v2_contracts     - 계약서 메타데이터 (status: processing/completed/failed)
v2_documents     - 문서 원본 및 텍스트
v2_embeddings    - 벡터 임베딩 vector(3072)
v2_reports       - 분석 리포트 (result_json + result_text)
```

**주요 인덱스:**
- `idx_v2_embeddings_vector` - IVFFlat 벡터 인덱스
- `idx_v2_contracts_user_id` - 사용자별 계약서 조회
- `idx_v2_documents_contract_id` - 계약서별 문서 조회

---

### 1-2. 백엔드 DB 연동 강화

**작업 내역:**
- ✅ `services/ai/core/database.py` 작성
  - SQLAlchemy 모델 정의 (v2_ 테이블)
  - Profile, Contract, Document, Embedding, Report 모델
  - DB 세션 관리 (`get_session_maker`, `get_db_session`)
  - 헬퍼 함수: `create_contract`, `create_document`, `update_contract_status`, `create_report`

- ✅ `services/ai/ingest/validators.py` 작성
  - 파일 크기 검증 (최대 50MB)
  - 파일 확장자 검증 (.pdf만 허용)
  - MIME 타입 검증 (application/pdf)
  - 파일명 새니타이제이션 (Path traversal 방지)
  - 위험한 파일명 패턴 체크
  - contract_id 검증 (영문/숫자/언더스코어/하이픈만 허용)
  - 주소 검증 (최대 200자)

- ✅ `services/ai/app.py` - `/ingest` 엔드포인트 DB 연동
  - user_id 검증 (UUID 형식)
  - contract_id, 파일 검증
  - **트랜잭션 흐름**:
    1. `v2_contracts` 테이블에 레코드 생성 (status: processing)
    2. PDF 파싱
    3. `v2_documents` 테이블에 텍스트 저장
    4. 벡터 DB 업서트
    5. 상태 업데이트 (status: completed 또는 failed)
  - 에러 핸들링: 각 단계 실패 시 상태 업데이트 및 롤백
  - DB 세션 자동 종료 (finally 블록)

**DoD 달성:**
- ✅ SQLAlchemy 모델 작성 (v2_ 테이블)
- ✅ `/ingest` 엔드포인트 DB 연동 완료
- ✅ 파일 검증 로직 구현
- ⏳ 실제 PDF 업로드 테스트 (Supabase 설정 후)

---

### 1-3. v1/v2 데이터 분리 전략

**전략:**
- 기존 v1 서비스가 사용 중인 Supabase 프로젝트에서 v2 서비스를 분리
- 모든 v2 테이블명에 `v2_` prefix 사용
- `auth.users`는 공유하지만, 데이터는 완전 분리
- RLS 정책도 독립적으로 적용 (`v2_` prefix 포함)

**장점:**
- ✅ v1과 v2 동시 운영 가능
- ✅ 테이블명 충돌 없음
- ✅ 점진적 마이그레이션 가능
- ✅ 독립적인 스키마 관리

---

## 📊 파일 구조

### 생성된 파일:
```
db/
├─ schema_v2.sql              # v2 전체 스키마 (v2_ prefix)
├─ schema.sql                  # v1 호환 스키마 (백업)
├─ migrations/
│  └─ 001_initial_schema.sql  # v2 마이그레이션
└─ README.md                   # 설정 가이드

services/ai/
├─ core/
│  └─ database.py             # SQLAlchemy 모델 (v2)
├─ ingest/
│  └─ validators.py           # 파일 검증
└─ app.py                      # DB 연동 (업데이트)
```

---

## 🧪 테스트 가이드

### 1. Supabase 스키마 적용

#### 방법 1: SQL Editor (권장)

1. [Supabase 대시보드](https://app.supabase.com) → 프로젝트 선택
2. **SQL Editor** 클릭
3. `db/schema_v2.sql` 전체 내용 복사
4. SQL Editor에 붙여넣기
5. **Run** 클릭

#### 방법 2: 마이그레이션 파일

1. `db/migrations/001_initial_schema.sql` 사용
2. 동일하게 SQL Editor에서 실행

#### 검증:

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
-- pgvector 확장 확인
SELECT * FROM pg_extension WHERE extname = 'vector';

-- RLS 활성화 확인
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'v2_%';

-- 모든 v2_ 테이블의 rowsecurity가 true여야 함
```

---

### 2. 백엔드 환경 변수 설정

`services/ai/.env` 파일:

```env
# 기존 Supabase URL 사용
DATABASE_URL=postgresql://postgres:x9HLz4pQVTDzaS3w@db.gsiismzchtgdklvdvggu.supabase.co:5432/postgres

# LLM API Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# 기타 설정
PRIMARY_LLM=openai
JUDGE_LLM=claude
EMBED_MODEL=text-embedding-3-large
```

---

### 3. 백엔드 서버 테스트

```bash
# 1. 의존성 설치 (아직 안 했다면)
cd services/ai
pip install -r requirements.txt

# 2. 서버 시작
uvicorn app:app --reload

# 3. 헬스체크
curl http://localhost:8000/healthz

# 예상 응답:
# {"ok":true,"version":"2.0.0","environment":"development"}
```

---

### 4. PDF 업로드 테스트 (Supabase 설정 후)

```bash
# 샘플 PDF 업로드
curl -X POST http://localhost:8000/ingest \
  -F "file=@sample_contract.pdf" \
  -F "contract_id=test_001" \
  -F "addr=서울시 강남구 테헤란로 123" \
  -F "user_id=00000000-0000-0000-0000-000000000000"

# 예상 응답:
# {
#   "ok": true,
#   "contract_id": "test_001",
#   "length": 15234,
#   "chunks": 12
# }
```

#### DB 확인:

```sql
-- contracts 테이블 확인
SELECT * FROM v2_contracts WHERE contract_id = 'test_001';

-- documents 테이블 확인
SELECT id, contract_id, file_name, text_length
FROM v2_documents
WHERE contract_id IN (
    SELECT id FROM v2_contracts WHERE contract_id = 'test_001'
);

-- embeddings 확인 (PGVector 테이블)
SELECT COUNT(*) as chunk_count
FROM langchain_pg_embedding
WHERE cmetadata->>'doc_id' = 'test_001';
```

---

### 5. RLS 정책 테스트

```sql
-- 1. 테스트 사용자 2명 생성 (Supabase Auth)
-- user_a: UUID A
-- user_b: UUID B

-- 2. user_a로 데이터 삽입
-- (PDF 업로드 API 사용)

-- 3. user_b로 로그인 후 조회 시도
SELECT * FROM v2_contracts WHERE contract_id = 'user_a_contract';

-- 예상: 0개 행 반환 (RLS로 차단)

-- 4. user_a로 다시 로그인 후 조회
SELECT * FROM v2_contracts WHERE contract_id = 'user_a_contract';

-- 예상: 1개 행 반환 (본인 데이터)
```

---

## ✅ DoD 체크리스트

### 1-1. Supabase 스키마 + pgvector + RLS
- [x] `db/schema_v2.sql` 작성 완료 (v2_ prefix)
- [x] 5개 테이블 정의 (v2_profiles, v2_contracts, v2_documents, v2_embeddings, v2_reports)
- [x] pgvector 확장 활성화 SQL 포함
- [x] IVFFlat 인덱스 생성 SQL 포함 (lists=100)
- [x] RLS 정책 SQL 포함 (15개 정책)
- [x] Supabase SQL Editor에서 실행 가능
- [ ] **실제 Supabase에 적용** (프론트엔드 개발자와 협업)

### 1-2. 파일/스토리지 레이어
- [x] `core/database.py` SQLAlchemy 모델 작성 (v2_ 테이블)
- [x] `/ingest` 엔드포인트 DB 연동 완료
- [x] 파일 검증 로직 구현 (`validators.py`)
- [ ] **샘플 PDF 업로드 테스트** (Supabase 설정 후)
- [ ] DB에 contracts, documents 레코드 생성 확인
- [ ] RLS 정책 동작 확인 (타 user_id 접근 차단)

---

## 🎯 다음 단계: P2 — 인덱싱 & 단일모델 분석 (Day 3~6)

### 2-1. 파싱→청크→업서트 (완성도 높이기)
- [ ] PDF 파싱 전략 개선 (hi_res, ocr_only 옵션)
- [ ] 페이지별 메타데이터 포함
- [ ] 청크 크기 최적화 (1200/150 → 튜닝)
- [ ] 에러 처리 강화

### 2-2. 벡터 검색/Retriever
- [ ] Retriever 파라미터 튜닝 (k, search_type)
- [ ] MMR (Maximal Marginal Relevance) 테스트
- [ ] 검색 품질 평가

### 2-3. 단일모델 분석 체인
- [ ] 프롬프트 개선 (구조화 출력)
- [ ] 응답 파싱 (JSON 스키마)
- [ ] 리포트 DB 저장 (v2_reports)
- [ ] GET /reports/{id} 구현

---

## 🛠️ 프론트엔드 협업 포인트

### 프론트엔드에서 확인할 사항:

1. **환경 변수 업데이트**
   - `apps/web/.env.local`에 Supabase 정보 확인
   - 이미 설정됨: `NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL`

2. **API 호출 수정**
   - `/ingest` 엔드포인트에 `user_id` 파라미터 추가 필요
   - 현재는 Form 데이터로 전달
   - 향후: JWT 토큰에서 자동 추출로 변경 예정

3. **Supabase 스키마 적용**
   - `db/schema_v2.sql` 실행 필요
   - v1과 충돌 없이 안전하게 적용 가능

4. **테스트 시나리오**
   - PDF 업로드 → DB 확인
   - Supabase 대시보드에서 v2_contracts, v2_documents 테이블 조회

---

## 📝 참고 사항

### 현재 구현 상태
- ✅ **DB 스키마 설계** 완료 (v2_ prefix 전략)
- ✅ **SQLAlchemy 모델** 완료
- ✅ **파일 검증 시스템** 완료
- ✅ **DB 연동 API** 완료
- ⏳ **실제 DB 적용 및 테스트** (Supabase 설정 대기)

### 미구현 기능 (향후 단계)
- ⏳ JWT 인증 통합 (user_id 자동 추출)
- ⏳ Supabase Storage 연동 (파일 영구 저장)
- ⏳ 리포트 조회 API (GET /reports/{id})
- ⏳ 컨센서스 모드 (P3)
- ⏳ 비동기 큐 (P3)

### v1/v2 호환성
- ✅ v1 테이블과 충돌 없음 (v2_ prefix)
- ✅ auth.users 공유 (사용자 인증)
- ✅ 독립적인 RLS 정책
- ✅ 점진적 마이그레이션 가능

---

## 🎉 결론

**P1 — 데이터/보안 토대** 작업이 성공적으로 완료되었습니다!

### 주요 성과
1. ✅ Supabase v2 스키마 설계 및 SQL 작성
2. ✅ pgvector 확장 및 IVFFlat 인덱스 준비
3. ✅ RLS 정책 15개 정의 (사용자별 데이터 격리)
4. ✅ SQLAlchemy 모델 구현 (v2_ 테이블)
5. ✅ 파일 검증 시스템 구축
6. ✅ DB 연동 API 구현 (/ingest 트랜잭션 처리)

### 테스트 준비 완료
- Supabase SQL Editor에서 `schema_v2.sql` 실행만 하면 바로 사용 가능
- 백엔드 서버는 DB 연동 준비 완료
- 프론트엔드와 협업하여 실제 테스트 진행

**다음 작업: Supabase 스키마 적용 → 실제 PDF 업로드 테스트 → P2 작업 시작**
