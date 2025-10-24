# Supabase CLI 사용 가이드

## 📋 사전 요구사항

### 1. Supabase CLI 설치

```bash
# Windows (Scoop)
scoop install supabase

# macOS (Homebrew)
brew install supabase/tap/supabase

# npm (모든 플랫폼)
npm install -g supabase
```

### 2. 로그인

```bash
supabase login
```

---

## 🚀 로컬 개발 환경 설정

### 1. Supabase 로컬 시작

```bash
cd C:\dev\zipcheckv2
supabase start
```

출력 예시:
```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. 마이그레이션 적용

```bash
# 모든 마이그레이션 실행
supabase db reset

# 또는 특정 마이그레이션만 실행
supabase migration up
```

### 3. Seed 데이터 삽입

```bash
supabase db seed
```

---

## 🔄 원격 (Production) 배포

### 1. 프로젝트 링크

```bash
# Supabase 프로젝트 연결
supabase link --project-ref gsiismzchtgdklvdvggu

# 확인
supabase projects list
```

### 2. 마이그레이션 배포

```bash
# 원격 DB에 마이그레이션 적용
supabase db push

# 또는 특정 마이그레이션만
supabase migration up --remote
```

### 3. 배포 확인

```bash
# 원격 DB 상태 확인
supabase db diff

# 마이그레이션 히스토리
supabase migration list
```

---

## 📝 새 마이그레이션 생성

### 1. 마이그레이션 파일 생성

```bash
# 새 마이그레이션 파일 생성
supabase migration new add_new_feature

# 파일 위치: supabase/migrations/20250124HHMMSS_add_new_feature.sql
```

### 2. SQL 작성 및 테스트

```bash
# 로컬에서 테스트
supabase db reset

# Studio에서 확인
# http://localhost:54323
```

### 3. 원격 배포

```bash
supabase db push
```

---

## 🛠️ 유용한 명령어

### DB 관리

```bash
# DB 초기화 (모든 마이그레이션 재실행)
supabase db reset

# 현재 DB 스키마 덤프
supabase db dump --schema public > schema.sql

# SQL 파일 실행
psql postgresql://postgres:postgres@localhost:54322/postgres -f your_script.sql
```

### 마이그레이션 관리

```bash
# 마이그레이션 목록
supabase migration list

# 특정 마이그레이션까지 롤백
supabase migration repair 20250124000001

# 마이그레이션 diff 확인
supabase db diff -f new_migration_name
```

### Functions (Edge Functions)

```bash
# 새 함수 생성
supabase functions new my-function

# 로컬 실행
supabase functions serve

# 배포
supabase functions deploy my-function
```

---

## 🧪 개발 워크플로우

### 시나리오: 새 기능 추가

```bash
# 1. 로컬 Supabase 시작
supabase start

# 2. 새 마이그레이션 생성
supabase migration new add_payment_table

# 3. SQL 작성
code supabase/migrations/20250124HHMMSS_add_payment_table.sql

# 4. 로컬 테스트
supabase db reset

# 5. Studio에서 확인
open http://localhost:54323

# 6. Next.js 개발 서버와 함께 테스트
cd apps/web
npm run dev

# 7. 문제 없으면 원격 배포
supabase db push
```

---

## 🔐 관리자 계정 설정

### 방법 1: seed.sql 수정

```sql
-- supabase/seed.sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'your-email@zipcheck.kr';
```

```bash
# 로컬에서 적용
supabase db reset

# 원격에서 적용
psql $DATABASE_URL -c "UPDATE public.users SET role = 'admin' WHERE email = 'your-email@zipcheck.kr';"
```

### 방법 2: Supabase Studio에서 직접 수정

1. http://localhost:54323 (로컬) 또는 Supabase Dashboard (원격) 접속
2. Table Editor → users 테이블
3. 해당 사용자 row 찾기
4. role 컬럼을 'admin'으로 변경

### 방법 3: psql 직접 연결

```bash
# 로컬
psql postgresql://postgres:postgres@localhost:54322/postgres

# 원격 (Supabase Dashboard에서 연결 문자열 복사)
psql "postgresql://postgres:[YOUR-PASSWORD]@db.gsiismzchtgdklvdvggu.supabase.co:5432/postgres"
```

```sql
-- SQL 실행
UPDATE public.users
SET role = 'admin'
WHERE email = 'admin@zipcheck.kr';

-- 확인
SELECT id, email, role FROM public.users WHERE role = 'admin';
```

---

## 📊 감사 로그 조회

### 로그 함수 사용

```sql
-- 관리자 액션 로깅
SELECT public.log_admin_action(
  'VIEW_DASHBOARD',
  NULL,
  '{"page": "analytics"}'::jsonb
);

-- 최근 로그 조회
SELECT * FROM public.admin_logs
ORDER BY created_at DESC
LIMIT 20;

-- 특정 사용자 로그
SELECT * FROM public.admin_logs
WHERE user_email = 'admin@zipcheck.kr'
ORDER BY created_at DESC;

-- 액션별 통계
SELECT action, COUNT(*) as count
FROM public.admin_logs
GROUP BY action
ORDER BY count DESC;
```

### View 사용

```sql
-- 관리자 목록
SELECT * FROM public.admin_users;

-- 최근 활동
SELECT * FROM public.recent_admin_activities;
```

---

## 🐛 트러블슈팅

### "Cannot connect to Docker"
**원인**: Docker가 실행되지 않음
**해결**:
```bash
# Docker Desktop 시작
# 또는
docker --version  # Docker 설치 확인
```

### "Migration already exists"
**원인**: 동일한 타임스탬프의 마이그레이션 파일 존재
**해결**:
```bash
# 기존 파일 삭제 후 재생성
rm supabase/migrations/20250124HHMMSS_*.sql
supabase migration new new_name
```

### "Connection refused"
**원인**: Supabase가 시작되지 않았거나 포트 충돌
**해결**:
```bash
# Supabase 재시작
supabase stop
supabase start

# 포트 변경 (config.toml)
[db]
port = 54322  # 다른 포트로 변경
```

---

## 📚 참고 자료

- [Supabase CLI 공식 문서](https://supabase.com/docs/guides/cli)
- [마이그레이션 가이드](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [RLS 정책 작성](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL 함수](https://www.postgresql.org/docs/current/plpgsql.html)

---

**작성일**: 2025-01-24
**최종 업데이트**: 2025-01-24
