# ZipCheck v2 데이터베이스 설정 가이드

## 📊 데이터베이스 구조

ZipCheck v2는 Supabase (PostgreSQL + pgvector)를 사용합니다.

### 테이블 구조

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|-----------|
| `profiles` | 사용자 프로필 | user_id, name, email |
| `contracts` | 계약서 메타데이터 | contract_id, user_id, addr, status |
| `documents` | 문서 원본 및 텍스트 | contract_id, text, file_path |
| `embeddings` | 벡터 임베딩 | embedding vector(3072), chunk_text |
| `reports` | 분석 리포트 | contract_id, result_json, mode |

---

## 🚀 Supabase 설정 방법

### 1. Supabase 프로젝트 생성

1. [Supabase 대시보드](https://app.supabase.com) 접속
2. **New Project** 클릭
3. 프로젝트 정보 입력:
   - Name: `zipcheck-v2`
   - Database Password: 안전한 비밀번호 설정
   - Region: 가까운 지역 선택 (예: Northeast Asia - Seoul)
4. **Create new project** 클릭

### 2. pgvector 확장 활성화

#### 방법 1: SQL Editor 사용 (권장)

1. Supabase 대시보드 → **SQL Editor**
2. 다음 SQL 실행:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

3. **Run** 클릭

#### 방법 2: Database Settings 사용

1. **Database** → **Extensions**
2. `vector` 검색
3. **Enable** 클릭

### 3. 스키마 적용

#### 옵션 A: 전체 스키마 한 번에 적용 (권장)

1. Supabase 대시보드 → **SQL Editor**
2. **New query** 클릭
3. `db/schema.sql` 파일 내용 전체 복사
4. SQL Editor에 붙여넣기
5. **Run** 클릭

#### 옵션 B: 마이그레이션 파일 사용

1. Supabase 대시보드 → **SQL Editor**
2. `db/migrations/001_initial_schema.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기
4. **Run** 클릭

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
