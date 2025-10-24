-- ============================================================================
-- 관리자 설정 검증 스크립트
-- hourhong@zipcheck.kr 계정 상태 확인
-- ============================================================================

-- 1️⃣ 관리자 계정 확인
SELECT
  '1️⃣ 관리자 계정 확인' as check_name,
  CASE
    WHEN COUNT(*) = 1 THEN '✅ PASS'
    WHEN COUNT(*) = 0 THEN '❌ FAIL: 계정이 없습니다. Google OAuth로 먼저 로그인하세요.'
    ELSE '⚠️ WARNING: 중복 계정 발견'
  END as status,
  STRING_AGG(email || ' (role: ' || role || ')', ', ') as details
FROM public.users
WHERE email = 'hourhong@zipcheck.kr';

-- 상세 정보
SELECT
  id,
  email,
  role,
  created_at,
  updated_at
FROM public.users
WHERE email = 'hourhong@zipcheck.kr';

-- 2️⃣ role 컬럼 존재 및 제약조건 확인
SELECT
  '2️⃣ role 컬럼 설정 확인' as check_name,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ PASS'
    ELSE '❌ FAIL: role 컬럼이 없습니다.'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'role';

-- 3️⃣ admin_logs 테이블 존재 확인
SELECT
  '3️⃣ admin_logs 테이블 확인' as check_name,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ PASS'
    ELSE '❌ FAIL: admin_logs 테이블이 없습니다.'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'admin_logs';

-- 4️⃣ RLS 정책 확인
SELECT
  '4️⃣ RLS 정책 확인' as check_name,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ') as policies,
  CASE
    WHEN COUNT(*) >= 2 THEN '✅ PASS'
    ELSE '❌ FAIL: RLS 정책이 부족합니다.'
  END as status
FROM pg_policies
WHERE tablename = 'admin_logs';

-- 5️⃣ 헬퍼 함수 확인
SELECT
  '5️⃣ 헬퍼 함수 확인' as check_name,
  COUNT(*) as function_count,
  STRING_AGG(proname, ', ') as functions,
  CASE
    WHEN COUNT(*) >= 2 THEN '✅ PASS'
    ELSE '❌ FAIL: 헬퍼 함수가 누락되었습니다.'
  END as status
FROM pg_proc
WHERE proname IN ('is_admin', 'log_admin_action');

-- 6️⃣ 인덱스 확인
SELECT
  '6️⃣ 인덱스 확인' as check_name,
  COUNT(*) as index_count,
  STRING_AGG(indexname, ', ') as indexes,
  CASE
    WHEN COUNT(*) >= 4 THEN '✅ PASS'
    ELSE '⚠️ WARNING: 일부 인덱스가 누락되었습니다.'
  END as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('users', 'admin_logs')
  AND indexname IN (
    'idx_users_role',
    'idx_admin_logs_user_id',
    'idx_admin_logs_action',
    'idx_admin_logs_created_at'
  );

-- ============================================================================
-- 📊 전체 요약
-- ============================================================================
SELECT
  '📊 전체 요약' as summary,
  CASE
    WHEN (
      -- 관리자 계정 존재
      (SELECT COUNT(*) FROM public.users WHERE email = 'hourhong@zipcheck.kr' AND role = 'admin') = 1
      -- admin_logs 테이블 존재
      AND (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_logs') > 0
      -- RLS 정책 존재
      AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'admin_logs') >= 2
      -- 헬퍼 함수 존재
      AND (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('is_admin', 'log_admin_action')) >= 2
    ) THEN '✅ 모든 설정이 완료되었습니다! http://localhost:3000/zc-ops-nx7k2 접속 가능'
    ELSE '❌ 일부 설정이 누락되었습니다. 위 체크리스트를 확인하세요.'
  END as status;

-- ============================================================================
-- 🎯 다음 단계
-- ============================================================================
SELECT
  '🎯 다음 단계' as next_steps,
  '1️⃣ Next.js 개발 서버 시작: cd apps/web && npm run dev' as step_1,
  '2️⃣ 브라우저 접속: http://localhost:3000/zc-ops-nx7k2' as step_2,
  '3️⃣ Google OAuth로 hourhong@zipcheck.kr 로그인' as step_3,
  '4️⃣ 관리자 대시보드 확인 (KPI, 차트 등)' as step_4;
