-- Migration: 013_fix_v2_reports_user_id_not_null.sql
-- Purpose: v2_reports.user_id를 NOT NULL로 변경 (데이터 무결성 강화)
-- Author: Backend Team
-- Date: 2025-11-20

-- ===========================
-- Step 1: 기존 NULL 데이터 처리
-- ===========================
-- user_id가 NULL인 레코드를 case_id를 통해 user_id 채우기
UPDATE v2_reports
SET user_id = (
    SELECT user_id
    FROM v2_cases
    WHERE v2_cases.id = v2_reports.case_id
)
WHERE user_id IS NULL;

-- 검증: NULL 데이터 확인 (0이어야 함)
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM v2_reports
    WHERE user_id IS NULL;

    IF null_count > 0 THEN
        RAISE EXCEPTION 'v2_reports에 여전히 user_id가 NULL인 레코드가 % 개 존재합니다.', null_count;
    ELSE
        RAISE NOTICE 'v2_reports.user_id NULL 데이터 정리 완료 ✅';
    END IF;
END $$;

-- ===========================
-- Step 2: user_id NOT NULL 제약조건 추가
-- ===========================
ALTER TABLE v2_reports
ALTER COLUMN user_id SET NOT NULL;

RAISE NOTICE 'v2_reports.user_id NOT NULL 제약조건 추가 완료 ✅';

-- ===========================
-- Step 3: Foreign Key 인덱스 추가 (성능 최적화)
-- ===========================
-- 기존 인덱스가 없으면 추가
CREATE INDEX IF NOT EXISTS idx_v2_reports_user_id
ON v2_reports(user_id);

RAISE NOTICE 'v2_reports.user_id 인덱스 추가 완료 ✅';

-- ===========================
-- Step 4: RLS 정책 업데이트
-- ===========================
-- 기존 정책 삭제 (있으면)
DROP POLICY IF EXISTS "Users can view own reports" ON v2_reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON v2_reports;
DROP POLICY IF EXISTS "Users can update own reports" ON v2_reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON v2_reports;

-- 새 RLS 정책 생성 (user_id 기반)
CREATE POLICY "Users can view own reports"
ON v2_reports FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own reports"
ON v2_reports FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own reports"
ON v2_reports FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own reports"
ON v2_reports FOR DELETE
USING (user_id = auth.uid());

RAISE NOTICE 'v2_reports RLS 정책 업데이트 완료 ✅';

-- ===========================
-- Step 5: 검증 쿼리
-- ===========================
DO $$
DECLARE
    report_count INTEGER;
    null_user_count INTEGER;
BEGIN
    -- 전체 리포트 개수
    SELECT COUNT(*) INTO report_count FROM v2_reports;

    -- NULL user_id 개수 (0이어야 함)
    SELECT COUNT(*) INTO null_user_count FROM v2_reports WHERE user_id IS NULL;

    RAISE NOTICE '=== 마이그레이션 검증 결과 ===';
    RAISE NOTICE '전체 리포트 개수: %', report_count;
    RAISE NOTICE 'NULL user_id 개수: % (0이어야 함)', null_user_count;

    IF null_user_count = 0 THEN
        RAISE NOTICE '✅ 마이그레이션 성공!';
    ELSE
        RAISE EXCEPTION '❌ 마이그레이션 실패: NULL user_id 존재';
    END IF;
END $$;

-- ===========================
-- Rollback (필요 시)
-- ===========================
-- ALTER TABLE v2_reports ALTER COLUMN user_id DROP NOT NULL;
-- DROP POLICY IF EXISTS "Users can view own reports" ON v2_reports;
-- DROP POLICY IF EXISTS "Users can insert own reports" ON v2_reports;
-- DROP POLICY IF EXISTS "Users can update own reports" ON v2_reports;
-- DROP POLICY IF EXISTS "Users can delete own reports" ON v2_reports;