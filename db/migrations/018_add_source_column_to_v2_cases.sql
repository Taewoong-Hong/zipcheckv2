-- Migration 018: Add source column to v2_cases
-- Created: 2025-11-28
-- Purpose: Lab vs Service 케이스 구분을 위한 source 컬럼 추가

BEGIN;

-- ============================================
-- 1. source 컬럼 추가
-- ============================================

-- source 컬럼 추가 (기본값: 'service')
ALTER TABLE v2_cases
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'service';

-- 기존 데이터 업데이트 (NULL인 경우 'service'로 설정)
UPDATE v2_cases
SET source = 'service'
WHERE source IS NULL;

-- ============================================
-- 2. 인덱스 생성
-- ============================================

-- source 단일 인덱스
CREATE INDEX IF NOT EXISTS idx_v2_cases_source
ON v2_cases(source);

-- environment + source 복합 인덱스 (Lab 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_v2_cases_env_source
ON v2_cases(environment, source);

-- ============================================
-- 3. 코멘트 추가
-- ============================================

COMMENT ON COLUMN v2_cases.source IS 'Source identifier: lab (Analysis Lab), service (Main Service)';

-- ============================================
-- 4. 검증
-- ============================================

DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'v2_cases'
        AND column_name = 'source'
    ) INTO column_exists;

    IF column_exists THEN
        RAISE NOTICE '✅ source 컬럼이 v2_cases 테이블에 추가되었습니다';
    ELSE
        RAISE EXCEPTION '❌ source 컬럼 추가 실패';
    END IF;
END $$;

COMMIT;

-- ============================================
-- 사용 예시
-- ============================================
-- Lab 케이스: environment='dev', source='lab'
-- Service 케이스: environment='prod', source='service'
--
-- Lab 케이스 조회:
-- SELECT * FROM v2_cases WHERE environment = 'dev' AND source = 'lab';
--
-- Service 케이스 조회:
-- SELECT * FROM v2_cases WHERE environment = 'prod' AND source = 'service';
