-- =====================================================
-- Migration: 016_add_environment_field
-- Purpose: v2_cases와 v2_artifacts에 environment 필드 추가
-- Date: 2025-01-26
-- Issue: dev/prod 환경 분리를 위해 environment 필드 필요 (Analysis Lab용)
-- =====================================================

-- v2_cases 테이블에 environment 컬럼 추가
ALTER TABLE v2_cases
ADD COLUMN environment TEXT DEFAULT 'prod' NOT NULL;

-- v2_cases environment 체크 제약 조건 추가
ALTER TABLE v2_cases
ADD CONSTRAINT v2_cases_environment_check
CHECK (environment IN ('dev', 'prod'));

-- v2_artifacts 테이블에 environment 컬럼 추가
ALTER TABLE v2_artifacts
ADD COLUMN environment TEXT DEFAULT 'prod' NOT NULL;

-- v2_artifacts environment 체크 제약 조건 추가
ALTER TABLE v2_artifacts
ADD CONSTRAINT v2_artifacts_environment_check
CHECK (environment IN ('dev', 'prod'));

-- 확인 쿼리 - v2_cases
SELECT
    column_name,
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'v2_cases'
    AND column_name = 'environment';

-- 확인 쿼리 - v2_artifacts
SELECT
    column_name,
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'v2_artifacts'
    AND column_name = 'environment';

-- 제약 조건 확인
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE (conrelid = 'public.v2_cases'::regclass OR conrelid = 'public.v2_artifacts'::regclass)
    AND pg_get_constraintdef(oid) LIKE '%environment%';
