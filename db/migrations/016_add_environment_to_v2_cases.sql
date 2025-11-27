-- Migration 016: Add environment column to v2_cases
-- Created: 2025-01-27
-- Purpose: Support environment-specific case handling (dev, staging, production)

BEGIN;

-- ============================================
-- Add environment column to v2_cases
-- ============================================

ALTER TABLE v2_cases
ADD COLUMN IF NOT EXISTS environment TEXT
CHECK (environment IN ('dev', 'staging', 'production'));

-- Set default value for existing rows
UPDATE v2_cases
SET environment = 'production'
WHERE environment IS NULL;

-- Add index for efficient filtering by environment
CREATE INDEX IF NOT EXISTS idx_v2_cases_environment
ON v2_cases(environment);

-- Documentation
COMMENT ON COLUMN v2_cases.environment IS 'Environment identifier: dev (development), staging (testing), or production (live)';

-- ============================================
-- Verification
-- ============================================

DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'v2_cases'
        AND column_name = 'environment'
    ) INTO column_exists;

    IF column_exists THEN
        RAISE NOTICE '✅ environment column added successfully to v2_cases';
    ELSE
        RAISE EXCEPTION '❌ Failed to add environment column';
    END IF;
END $$;

COMMIT;
