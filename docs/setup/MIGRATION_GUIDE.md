# 📋 데이터베이스 마이그레이션 가이드

**작성일**: 2025-01-27
**마이그레이션 파일**: `db/migrations/003_chat_analysis_system.sql`

---

## 🎯 마이그레이션 목적

집체크 v2 채팅 기반 부동산 계약 분석 시스템의 핵심 테이블 생성:

- ✅ `v2_cases` - 분석 케이스 (주소, 계약 유형, 상태)
- ✅ `v2_artifacts` - 파일/문서 (등기부, 건축물대장, PDF)
- ✅ `v2_reports` - 분석 리포트 (리스크 점수, 요약)
- ✅ `v2_credit_transactions` - 크레딧 트랜잭션 (구매, 차감, 환불)
- ✅ `v2_audit_logs` - 감사 로그 (이벤트 추적)
- ✅ `v2_public_data_cache` - 공공 데이터 캐시 (API 응답 캐싱)

---

## 📝 마이그레이션 적용 방법

### ✅ 권장 방법 1: Supabase Dashboard (가장 안전)

1. **Supabase Dashboard 접속**:
   ```
   https://supabase.com/dashboard/project/gsiismzchtgdklvdvggu
   ```

2. **SQL Editor 이동**:
   - 왼쪽 메뉴 → **SQL Editor**

3. **마이그레이션 파일 복사**:
   - `db/migrations/003_chat_analysis_system.sql` 파일 전체 내용 복사

4. **실행**:
   - SQL Editor에 붙여넣기
   - **Run** 버튼 클릭

5. **검증**:
   ```sql
   -- 테이블 생성 확인
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name LIKE 'v2_%'
   ORDER BY table_name;

   -- 결과 (6개 테이블):
   -- v2_artifacts
   -- v2_audit_logs
   -- v2_cases
   -- v2_credit_transactions
   -- v2_public_data_cache
   -- v2_reports
   ```

---

### ✅ 방법 2: Supabase CLI (로컬 개발 환경)

```bash
# 1. Supabase CLI 설치 (한 번만)
npm install -g supabase

# 2. 프로젝트 연결
cd C:\dev\zipcheckv2
supabase link --project-ref gsiismzchtgdklvdvggu

# 3. 마이그레이션 적용
supabase db push
```

---

### ✅ 방법 3: PostgreSQL psql (설치된 경우)

```bash
# 마이그레이션 적용
psql "postgresql://postgres.gsiismzchtgdklvdvggu:Tkdgnsla09!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres" \
  -f db/migrations/003_chat_analysis_system.sql
```

---

## 🧪 마이그레이션 검증

### 1️⃣ 테이블 생성 확인

```sql
-- 모든 v2 테이블 조회
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name LIKE 'v2_%'
ORDER BY table_name;
```

**예상 결과**:
```
table_name                  | column_count
----------------------------+--------------
v2_artifacts                | 11
v2_audit_logs               | 9
v2_cases                    | 17
v2_credit_transactions      | 11
v2_public_data_cache        | 9
v2_reports                  | 13
```

### 2️⃣ RLS 정책 확인

```sql
-- RLS 활성화 확인
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'v2_%';
```

**예상 결과**: 모든 테이블의 `rowsecurity` = `true`

### 3️⃣ 트리거 확인

```sql
-- 트리거 조회
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table LIKE 'v2_%';
```

**예상 결과**:
```
trigger_name                        | event_object_table | action_statement
------------------------------------+--------------------+------------------
update_v2_cases_updated_at          | v2_cases           | EXECUTE FUNCTION update_updated_at_column()
update_v2_artifacts_updated_at      | v2_artifacts       | EXECUTE FUNCTION update_updated_at_column()
grant_welcome_credits_on_signup     | v2_profiles        | EXECUTE FUNCTION grant_welcome_credits()
```

### 4️⃣ 함수 확인

```sql
-- 헬퍼 함수 조회
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (
  routine_name LIKE '%credit%'
  OR routine_name LIKE 'log_audit'
  OR routine_name = 'delete_expired_cache'
);
```

**예상 결과**:
```
routine_name                | routine_type
---------------------------+--------------
get_user_credit_balance     | FUNCTION
deduct_credits              | FUNCTION
refund_credits              | FUNCTION
grant_welcome_credits       | FUNCTION
log_audit                   | FUNCTION
delete_expired_cache        | FUNCTION
```

---

## 🧹 롤백 (마이그레이션 되돌리기)

⚠️ **주의**: 롤백 시 모든 데이터가 삭제됩니다!

```sql
-- 트리거 삭제
DROP TRIGGER IF EXISTS update_v2_cases_updated_at ON v2_cases;
DROP TRIGGER IF EXISTS update_v2_artifacts_updated_at ON v2_artifacts;
DROP TRIGGER IF EXISTS grant_welcome_credits_on_signup ON v2_profiles;

-- 함수 삭제
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS get_user_credit_balance CASCADE;
DROP FUNCTION IF EXISTS deduct_credits CASCADE;
DROP FUNCTION IF EXISTS refund_credits CASCADE;
DROP FUNCTION IF EXISTS grant_welcome_credits CASCADE;
DROP FUNCTION IF EXISTS log_audit CASCADE;
DROP FUNCTION IF EXISTS delete_expired_cache CASCADE;

-- 테이블 삭제 (의존성 순서 고려)
DROP TABLE IF EXISTS v2_audit_logs CASCADE;
DROP TABLE IF EXISTS v2_credit_transactions CASCADE;
DROP TABLE IF EXISTS v2_reports CASCADE;
DROP TABLE IF EXISTS v2_artifacts CASCADE;
DROP TABLE IF EXISTS v2_cases CASCADE;
DROP TABLE IF EXISTS v2_public_data_cache CASCADE;
```

---

## 📊 초기 데이터 설정

### 1️⃣ 테스트 사용자 크레딧 지급

회원가입 시 자동으로 100 크레딧이 지급되도록 트리거가 설정되어 있습니다.

**수동 지급 (필요 시)**:
```sql
-- 특정 사용자에게 크레딧 지급
INSERT INTO v2_credit_transactions (
  user_id,
  transaction_type,
  amount,
  balance_after,
  reason,
  reason_code
) VALUES (
  'USER_UUID_HERE',
  'bonus',
  100,
  100,
  '테스트 크레딧 지급',
  'TEST_BONUS'
);
```

### 2️⃣ 캐시 만료 작업 스케줄링 (선택)

```sql
-- 매일 자정에 만료된 캐시 삭제 (pg_cron 사용 시)
SELECT cron.schedule(
  'delete-expired-cache',
  '0 0 * * *',  -- 매일 자정
  $$SELECT delete_expired_cache();$$
);
```

---

## 🔐 보안 설정

### RLS 정책 추가 검증

```sql
-- 각 테이블의 RLS 정책 확인
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename LIKE 'v2_%'
ORDER BY tablename, policyname;
```

### 암호화 필드 확인

⚠️ 다음 필드는 애플리케이션 레벨에서 암호화 필요:
- `v2_cases.address_road` - 도로명 주소
- `v2_cases.address_lot` - 지번 주소
- `v2_artifacts.parsed_data` - 파싱된 개인정보 포함 가능

---

## 🚨 트러블슈팅

### 문제 1: "permission denied for schema public"

**원인**: Service Role Key 대신 Anon Key 사용

**해결**:
- Supabase Dashboard에서 실행 (자동으로 Service Role 사용)
- 또는 Service Role Key 사용

### 문제 2: "relation v2_profiles does not exist"

**원인**: 이전 마이그레이션 (002) 미적용

**해결**:
```bash
# 이전 마이그레이션 먼저 적용
supabase db push --file db/migrations/002_add_encryption_and_profile_trigger.sql
```

### 문제 3: "function uuid_generate_v4() does not exist"

**원인**: uuid-ossp 확장 미설치

**해결**:
```sql
-- uuid-ossp 확장 설치
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 문제 4: 트리거 실행 안 됨

**원인**: 함수 정의 순서 문제

**해결**:
1. 함수 정의 부분을 먼저 실행
2. 트리거 생성 부분을 나중에 실행

---

## 📈 성능 최적화

### 인덱스 추가 생성 (필요 시)

```sql
-- Full-Text Search 인덱스 (주소 검색용)
CREATE INDEX IF NOT EXISTS idx_v2_cases_address_fts
ON v2_cases USING gin(to_tsvector('korean', address_road || ' ' || COALESCE(address_lot, '')));

-- JSONB 인덱스 (리포트 데이터 검색용)
CREATE INDEX IF NOT EXISTS idx_v2_reports_report_data_gin
ON v2_reports USING gin(report_data);

-- 파셜 인덱스 (활성 케이스만)
CREATE INDEX IF NOT EXISTS idx_v2_cases_active
ON v2_cases(user_id, created_at DESC)
WHERE state NOT IN ('report', 'error');
```

---

## 🎓 다음 단계

1. ✅ 마이그레이션 적용 완료
2. ⬜ 프론트엔드 UI 컴포넌트 구현
3. ⬜ FastAPI 라우터 구현
4. ⬜ PDF 파싱 파이프라인 구현
5. ⬜ 공공 데이터 수집 어댑터 구현
6. ⬜ 규칙 엔진 구현
7. ⬜ LLM 라우터 구현
8. ⬜ 크레딧 시스템 구현
9. ⬜ E2E 테스트 작성

---

**마지막 업데이트**: 2025-01-27
