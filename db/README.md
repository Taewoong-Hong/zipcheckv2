# ZipCheck v2 데이터베이스 설정 가이드

## 📁 Directory Structure

```
db/
├── migrations/         # 순차적 스키마 변경 (001-014)
├── schema/            # 참조용 스키마 스냅샷
├── admin/             # 관리자 설정 스크립트
├── utils/             # 유틸리티 SQL 스크립트
└── seed.sql           # 개발용 시드 데이터
```

## 📊 데이터베이스 구조

ZipCheck v2는 Supabase (PostgreSQL + pgvector)를 사용합니다.

### V2 테이블 구조

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|-----------|
| `v2_profiles` | 사용자 프로필 | user_id, name, email, credit |
| `v2_cases` | 분석 케이스 | case_id, user_id, property_address, current_state |
| `v2_artifacts` | 업로드 파일 | artifact_id, case_id, artifact_type, file_url |
| `v2_reports` | 분석 리포트 | report_id, case_id, risk_score, content |
| `conversations` | 채팅 대화 | conversation_id, user_id, title |
| `messages` | 채팅 메시지 | message_id, conversation_id, role, content |

---

## 🔄 Migrations

마이그레이션 파일은 순차적으로 번호가 매겨져 있습니다:

- **001-007**: 초기 스키마 및 핵심 기능
- **008**: Artifacts bucket RLS 정책
- **012**: Registry support (등기부 지원)
- **013**: RLS security 강화
- **014**: Storage security policies

### Migration 실행 순서

```bash
# Supabase CLI 사용 (권장)
cd c:/dev/zipcheckv2
supabase db push

# 또는 SQL Editor에서 순차적으로 실행
# 001 → 002 → ... → 014 순서로 실행
```

### Migration 작성 규칙

1. **순차적 번호**: 마지막 번호 + 1 (다음은 015)
2. **파일명 형식**: `###_description.sql` (예: `015_add_new_feature.sql`)
3. **Rollback 고려**: 가능한 경우 `-- Rollback` 섹션 포함
4. **주석 필수**: 변경 사유 및 영향 범위 명시

---

## 📋 Schema Snapshots

참조용 스키마 스냅샷 (`schema/`):

- **schema_v2.sql**: 전체 v2 스키마 (v2_cases, v2_reports, v2_artifacts 등)
- **schema_realestate.sql**: 부동산 관련 테이블 참조

⚠️ **주의**: 스키마 파일은 참조용이며, 실제 변경은 `migrations/`에서 수행합니다.

---

## 👤 Admin Scripts

관리자 계정 및 권한 설정 (`admin/`):

1. **20250123_01_set_admin_ghdxodnd.sql**: 관리자 사용자 생성
2. **20250123_02_check_email_exists.sql**: 이메일 검증 함수
3. **20250124000001_add_admin_role_and_logs.sql**: 관리자 역할 및 감사 로그
4. **20250124000002_add_missing_admin_support.sql**: 추가 관리자 지원 기능

### 실행 순서

```bash
# SQL Editor에서 순서대로 실행
cd admin/
# 1 → 2 → 3 → 4 순서로 실행
```

---

## 🛠️ Utility Scripts

유틸리티 스크립트 (`utils/`):

- **check_view.sql**: 뷰 존재 여부 및 정의 확인
- **update_artifacts_mime.sql**: Artifacts MIME 타입 일괄 업데이트

### 사용 예시

```sql
-- check_view.sql
-- recent_conversations 뷰 확인용

-- update_artifacts_mime.sql
-- PDF MIME 타입 수정용
UPDATE storage.objects
SET metadata = jsonb_set(metadata, '{mimetype}', '"application/pdf"')
WHERE bucket_id = 'artifacts' AND name LIKE '%.pdf';
```

---

## 🌱 Seed Data

**seed.sql**: 개발 환경 테스트용 샘플 데이터

```bash
# 로컬 개발 환경에서만 사용
psql -h localhost -U postgres -d zipcheck -f db/seed.sql
```

⚠️ **경고**: 프로덕션 환경에서는 절대 실행하지 마세요.

---

## 🚀 Supabase 설정 방법

### 1. pgvector 확장 활성화

```sql
-- SQL Editor에서 실행
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. 마이그레이션 실행

```bash
# Supabase CLI
supabase db push

# 또는 SQL Editor에서 migrations/ 파일 순차 실행
```

### 3. 관리자 설정

```bash
# admin/ 스크립트 순차 실행 (1→2→3→4)
```

### 4. 스키마 검증

다음 SQL을 실행하여 테이블이 정상 생성되었는지 확인:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'contracts', 'documents', 'embeddings', 'reports');
```

**예상 결과**: 5개 테이블 모두 표시되어야 함

### 5. RLS (Row Level Security) 확인

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'contracts', 'documents', 'embeddings', 'reports');
```

**예상 결과**: 모든 테이블의 `rowsecurity`가 `true`여야 함

---

## 🔐 환경 변수 설정

### Supabase 연결 정보 가져오기

1. Supabase 대시보드 → **Settings** → **Database**
2. **Connection string** 섹션에서 **URI** 복사
3. 형식: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`

### 백엔드 환경 변수 설정

`services/ai/.env` 파일에 다음 추가:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
```

### 프론트엔드 환경 변수 설정

`apps/web/.env.local` 파일에 다음 추가:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**Anon Key 가져오기**:
1. Supabase 대시보드 → **Settings** → **API**
2. **Project API keys** → `anon` `public` 키 복사

---

## 🧪 테스트

### 1. 연결 테스트

Python에서 DB 연결 테스트:

```python
from sqlalchemy import create_engine
import os

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    result = conn.execute("SELECT 1")
    print("✅ DB 연결 성공!")
```

### 2. pgvector 확인

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**예상 결과**: 1개 행 반환 (extname: `vector`)

### 3. 인덱스 확인

```sql
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'embeddings'
AND indexname = 'idx_embeddings_vector';
```

**예상 결과**: IVFFlat 인덱스 정보 표시

### 4. RLS 정책 테스트

#### 준비: 테스트 사용자 생성

Supabase 대시보드 → **Authentication** → **Users** → **Add user**

#### 테스트 데이터 삽입

```sql
-- 현재 인증된 사용자로 데이터 삽입
INSERT INTO contracts (user_id, contract_id, addr)
VALUES (auth.uid(), 'test_001', '서울시 강남구 테헤란로 123')
RETURNING *;
```

#### RLS 정책 동작 확인

다른 사용자로 로그인 후:

```sql
-- 다른 사용자의 데이터에 접근 시도 (차단되어야 함)
SELECT * FROM contracts WHERE contract_id = 'test_001';
```

**예상 결과**: 0개 행 반환 (RLS로 인해 접근 차단)

---

## 📝 스키마 수정

### 컬럼 추가

```sql
ALTER TABLE contracts
ADD COLUMN new_column TEXT;
```

### 인덱스 추가

```sql
CREATE INDEX idx_contracts_new_column ON contracts(new_column);
```

### RLS 정책 수정

```sql
-- 기존 정책 삭제
DROP POLICY "Policy name" ON table_name;

-- 새 정책 생성
CREATE POLICY "New policy name"
    ON table_name FOR SELECT
    USING (user_id = auth.uid());
```

---

## 🔧 문제 해결

### 1. pgvector 확장이 활성화되지 않음

**증상**: `type "vector" does not exist` 오류

**해결**:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. RLS 정책으로 인해 데이터 접근 불가

**증상**: 데이터 삽입/조회가 안됨

**해결**:
- Supabase 대시보드에서 인증된 상태인지 확인
- RLS 정책이 올바르게 설정되었는지 확인:

```sql
SELECT * FROM pg_policies WHERE tablename = 'your_table_name';
```

### 3. 마이그레이션 실패

**증상**: "relation already exists" 오류

**해결**:
- `IF NOT EXISTS` 구문 사용
- 또는 기존 테이블 삭제 후 재생성:

```sql
DROP TABLE IF EXISTS table_name CASCADE;
```

⚠️ **주의**: CASCADE는 연관된 데이터도 삭제하므로 프로덕션 환경에서는 신중하게 사용

### 4. IVFFlat 인덱스 생성 실패

**증상**: "index type ivfflat not supported" 오류

**해결**:
1. pgvector 확장이 활성화되었는지 확인
2. 인덱스 생성 전 테이블에 데이터가 있는지 확인 (최소 몇 개 행 필요)

---

## 📚 참고 문서

- [Supabase 문서](https://supabase.com/docs)
- [pgvector 문서](https://github.com/pgvector/pgvector)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [IVFFlat 인덱스](https://github.com/pgvector/pgvector#ivfflat)

---

## 🎯 다음 단계

1. ✅ Supabase 프로젝트 생성
2. ✅ pgvector 확장 활성화
3. ✅ 스키마 적용
4. ✅ 환경 변수 설정
5. ⏳ 백엔드 DB 연동 구현 → [services/ai/core/database.py](../services/ai/core/database.py)
6. ⏳ 프론트엔드 Supabase 클라이언트 설정

---

**문제가 발생하면 [Issues](https://github.com/your-repo/issues)에 제보해주세요!**
