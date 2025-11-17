-- ============================================
-- Migration: Add RLS Policies for v2_cases Table
-- Date: 2025-11-17
-- Description: v2_cases 테이블에 RLS 정책 추가 (404 에러 수정)
-- ============================================

-- 1. v2_cases 테이블 RLS 활성화 (이미 활성화되어 있을 수 있음)
ALTER TABLE v2_cases ENABLE ROW LEVEL SECURITY;

-- 2. 기존 정책 삭제 (있을 경우)
DROP POLICY IF EXISTS "Users can view own cases" ON v2_cases;
DROP POLICY IF EXISTS "Users can create own cases" ON v2_cases;
DROP POLICY IF EXISTS "Users can update own cases" ON v2_cases;
DROP POLICY IF EXISTS "Users can delete own cases" ON v2_cases;
DROP POLICY IF EXISTS "Admins can view all cases" ON v2_cases;
DROP POLICY IF EXISTS "Admins can delete all cases" ON v2_cases;

-- 3. v2_cases SELECT 정책 (사용자는 자신의 케이스만 조회)
CREATE POLICY "Users can view own cases"
ON v2_cases
FOR SELECT
USING (auth.uid() = user_id);

-- 4. v2_cases INSERT 정책 (사용자는 자신의 케이스만 생성)
CREATE POLICY "Users can create own cases"
ON v2_cases
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 5. v2_cases UPDATE 정책 (사용자는 자신의 케이스만 수정)
CREATE POLICY "Users can update own cases"
ON v2_cases
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. v2_cases DELETE 정책 (사용자는 자신의 케이스만 삭제)
CREATE POLICY "Users can delete own cases"
ON v2_cases
FOR DELETE
USING (auth.uid() = user_id);

-- 7. 관리자 정책 추가
CREATE POLICY "Admins can view all cases"
ON v2_cases
FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
);

CREATE POLICY "Admins can delete all cases"
ON v2_cases
FOR DELETE
USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
);

-- 8. v2_artifacts 테이블 RLS 정책 (케이스 기반 접근)
ALTER TABLE v2_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view artifacts of own cases" ON v2_artifacts;
DROP POLICY IF EXISTS "Users can insert artifacts for own cases" ON v2_artifacts;
DROP POLICY IF EXISTS "Users can delete artifacts of own cases" ON v2_artifacts;

CREATE POLICY "Users can view artifacts of own cases"
ON v2_artifacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM v2_cases
    WHERE v2_cases.id = v2_artifacts.case_id
    AND v2_cases.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert artifacts for own cases"
ON v2_artifacts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM v2_cases
    WHERE v2_cases.id = v2_artifacts.case_id
    AND v2_cases.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete artifacts of own cases"
ON v2_artifacts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM v2_cases
    WHERE v2_cases.id = v2_artifacts.case_id
    AND v2_cases.user_id = auth.uid()
  )
);

-- ============================================
-- 검증 쿼리
-- ============================================
-- RLS 활성화 확인:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('v2_cases', 'v2_artifacts');
--
-- 정책 확인:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename IN ('v2_cases', 'v2_artifacts')
-- ORDER BY tablename, policyname;
-- ============================================

-- 9. 코멘트 추가
COMMENT ON POLICY "Users can view own cases" ON v2_cases IS
  '사용자는 자신이 생성한 케이스만 조회할 수 있습니다.';

COMMENT ON POLICY "Users can create own cases" ON v2_cases IS
  '사용자는 자신의 user_id로만 케이스를 생성할 수 있습니다.';

COMMENT ON POLICY "Admins can view all cases" ON v2_cases IS
  '관리자는 모든 케이스를 조회할 수 있습니다 (관리 및 지원 목적).';
