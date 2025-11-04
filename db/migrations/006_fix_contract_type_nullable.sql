-- =====================================================
-- Migration: 006_fix_contract_type_nullable
-- Purpose: contract_type 컬럼을 NULL 허용으로 변경
-- Date: 2025-11-03
-- Issue: 케이스 생성 단계에서 계약유형이 아직 미선택 상태이므로 NULL 허용 필요
-- =====================================================

-- v2_cases.contract_type NOT NULL 제약 제거
ALTER TABLE v2_cases
ALTER COLUMN contract_type DROP NOT NULL;

-- 기존 CHECK 제약은 NULL을 통과하므로 별도 수정 불필요
-- CHECK (contract_type IN ('매매', '전세', '월세', '기타'))는 유지

-- 확인 쿼리
SELECT
    column_name,
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'v2_cases'
    AND column_name = 'contract_type';

-- 제약 조건 확인
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.v2_cases'::regclass
    AND pg_get_constraintdef(oid) LIKE '%contract_type%';