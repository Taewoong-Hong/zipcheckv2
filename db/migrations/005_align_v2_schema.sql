-- ============================================
-- v2 schema alignment (cases, reports, artifacts)
-- ============================================
-- 작성일: 2025-01-30
-- 목적:
-- 1) v2_cases: state → current_state, 주소 통합(property_address)
-- 2) v2_reports: report_data 유지, risk_score를 JSONB로 정규화하고 content/registry_data/market_data 추가
-- 3) v2_artifacts: user_id 컬럼 추가 및 백필 (case 연결 기반)
-- ============================================

-- ============
-- v2_cases
-- ============
DO $$
BEGIN
    -- 1) state → current_state (존재 시만 수행)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='v2_cases' AND column_name='state'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='v2_cases' AND column_name='current_state'
    ) THEN
        EXECUTE 'ALTER TABLE v2_cases RENAME COLUMN state TO current_state';
    END IF;

    -- 2) property_address 추가 (없을 때만)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='v2_cases' AND column_name='property_address'
    ) THEN
        EXECUTE 'ALTER TABLE v2_cases ADD COLUMN property_address TEXT';
    END IF;

    -- 3) 주소 통합 백필: address_road 우선, 없으면 address_lot
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='v2_cases' AND column_name='property_address'
    ) THEN
        UPDATE v2_cases
        SET property_address = COALESCE(property_address, NULLIF(TRIM(address_road), ''), NULLIF(TRIM(address_lot), ''))
        WHERE property_address IS NULL;
    END IF;

    -- 4) 인덱스 생성 (없을 때만)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename='v2_cases' AND indexname='idx_v2_cases_current_state'
    ) THEN
        EXECUTE 'CREATE INDEX idx_v2_cases_current_state ON v2_cases(current_state)';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename='v2_cases' AND indexname='idx_v2_cases_property_address'
    ) THEN
        EXECUTE 'CREATE INDEX idx_v2_cases_property_address ON v2_cases(property_address)';
    END IF;
END $$;

-- ============
-- v2_reports
-- ============
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1) risk_score 관련 CHECK 제약 조건 제거 (있으면)
    FOR r IN (
        SELECT conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE t.relname = 'v2_reports'
          AND pg_get_constraintdef(c.oid) ILIKE '%risk_score%'
    ) LOOP
        EXECUTE format('ALTER TABLE v2_reports DROP CONSTRAINT %I', r.conname);
    END LOOP;

    -- 2) risk_score를 JSONB로 변경 (숫자 → {total_score: N}로 승격)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='v2_reports' AND column_name='risk_score' AND data_type IN ('integer', 'bigint', 'numeric')
    ) THEN
        EXECUTE 'ALTER TABLE v2_reports ALTER COLUMN risk_score TYPE JSONB USING jsonb_build_object(''total_score'', risk_score)';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='v2_reports' AND column_name='risk_score'
    ) THEN
        EXECUTE 'ALTER TABLE v2_reports ADD COLUMN risk_score JSONB DEFAULT ''{}''::jsonb';
    END IF;

    -- 3) content/registry_data/market_data 컬럼 추가 (없을 때만)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='v2_reports' AND column_name='content'
    ) THEN
        EXECUTE 'ALTER TABLE v2_reports ADD COLUMN content TEXT';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='v2_reports' AND column_name='registry_data'
    ) THEN
        EXECUTE 'ALTER TABLE v2_reports ADD COLUMN registry_data JSONB';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='v2_reports' AND column_name='market_data'
    ) THEN
        EXECUTE 'ALTER TABLE v2_reports ADD COLUMN market_data JSONB';
    END IF;

    -- 4) user_id 컬럼 추가 및 백필 (코드에서 직접 필터 사용함)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='v2_reports' AND column_name='user_id'
    ) THEN
        ALTER TABLE v2_reports ADD COLUMN user_id UUID;

        -- 백필 (EXECUTE 없이 직접 실행)
        UPDATE v2_reports rep
        SET user_id = c.user_id
        FROM v2_cases c
        WHERE rep.case_id = c.id AND rep.user_id IS NULL;

        -- 인덱스 생성
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE tablename='v2_reports' AND indexname='idx_v2_reports_user_id'
        ) THEN
            CREATE INDEX idx_v2_reports_user_id ON v2_reports(user_id);
        END IF;
    END IF;
END $$;

-- ============
-- v2_artifacts
-- ============
DO $$
BEGIN
    -- user_id 컬럼 추가 (없을 때만)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='v2_artifacts' AND column_name='user_id'
    ) THEN
        EXECUTE 'ALTER TABLE v2_artifacts ADD COLUMN user_id UUID NULL REFERENCES auth.users(id)';
    END IF;

    -- 기존 데이터 백필: case_id → v2_cases.user_id 조인
    IF EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='v2_artifacts' AND column_name='user_id'
    ) THEN
        UPDATE v2_artifacts a
        SET user_id = c.user_id
        FROM v2_cases c
        WHERE a.case_id = c.id AND a.user_id IS NULL;
    END IF;
END $$;

-- ============================================
-- 완료
-- ============================================
-- 적용 방법 (Supabase CLI):
-- 1) supabase db push
--    또는 Supabase Dashboard → SQL Editor에서 실행
-- ============================================
