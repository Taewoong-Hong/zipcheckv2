-- ============================================
-- 스키마-코드 정렬 마이그레이션
-- ============================================
-- 작성일: 2025-01-30
-- 버전: 1.1.0
-- 설명: 실제 코드와 스키마를 정렬 (코드 기준)
-- ============================================

-- ============================================
-- 1. v2_cases 테이블 수정
-- ============================================

-- 1-1. 주소 필드 통합: address_road/address_lot → property_address
DO $$
BEGIN
    -- property_address 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'v2_cases' AND column_name = 'property_address'
    ) THEN
        ALTER TABLE v2_cases ADD COLUMN property_address TEXT;

        -- 기존 데이터 마이그레이션 (address_road 우선, 없으면 address_lot)
        UPDATE v2_cases
        SET property_address = COALESCE(address_road, address_lot)
        WHERE property_address IS NULL;

        -- property_address를 NOT NULL로 변경
        ALTER TABLE v2_cases ALTER COLUMN property_address SET NOT NULL;

        -- 기존 컬럼 제거 (데이터 백업 후)
        -- ALTER TABLE v2_cases DROP COLUMN address_road;
        -- ALTER TABLE v2_cases DROP COLUMN address_lot;

        RAISE NOTICE 'property_address 컬럼 추가 완료';
    END IF;
END $$;

-- 1-2. 상태 필드 이름 변경: state → current_state
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'v2_cases' AND column_name = 'current_state'
    ) THEN
        -- current_state 컬럼 추가 (임시로 NULL 허용)
        ALTER TABLE v2_cases ADD COLUMN current_state TEXT;

        -- 기존 데이터 복사
        UPDATE v2_cases SET current_state = state WHERE current_state IS NULL;

        -- NOT NULL 제약 추가
        ALTER TABLE v2_cases ALTER COLUMN current_state SET NOT NULL;

        -- 기본값 설정
        ALTER TABLE v2_cases ALTER COLUMN current_state SET DEFAULT 'address';

        -- state 컬럼 제거는 보류 (백업용)
        -- ALTER TABLE v2_cases DROP COLUMN state;

        RAISE NOTICE 'current_state 컬럼 추가 완료';
    END IF;
END $$;

-- 1-3. current_state CHECK 제약 조건 추가 (단순화된 상태)
DO $$
BEGIN
    -- 기존 state CHECK 제약 제거 (있으면)
    ALTER TABLE v2_cases DROP CONSTRAINT IF EXISTS v2_cases_state_check;

    -- 새 current_state CHECK 제약 추가
    ALTER TABLE v2_cases DROP CONSTRAINT IF EXISTS v2_cases_current_state_check;

    ALTER TABLE v2_cases ADD CONSTRAINT v2_cases_current_state_check
    CHECK (current_state IN (
        'address',      -- 주소 입력 단계
        'contract',     -- 계약서 업로드 단계
        'registry',     -- 등기부 업로드 단계
        'analysis',     -- 분석 중
        'report',       -- 리포트 생성 완료
        'completed',    -- 완료
        'error'         -- 에러 상태
    ));

    RAISE NOTICE 'current_state CHECK 제약 추가 완료';
END $$;

-- 1-4. 인덱스 업데이트
DROP INDEX IF EXISTS idx_v2_cases_state;
CREATE INDEX IF NOT EXISTS idx_v2_cases_current_state ON v2_cases(current_state);

-- ============================================
-- 2. v2_reports 테이블 수정
-- ============================================

-- 2-1. content 컬럼 추가 (LLM 최종 답변 텍스트)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'v2_reports' AND column_name = 'content'
    ) THEN
        ALTER TABLE v2_reports ADD COLUMN content TEXT;

        -- 기존 final_summary 데이터를 content로 복사
        UPDATE v2_reports SET content = final_summary WHERE content IS NULL;

        RAISE NOTICE 'content 컬럼 추가 완료';
    END IF;
END $$;

-- 2-2. registry_data 컬럼 추가 (마스킹된 등기부 정보)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'v2_reports' AND column_name = 'registry_data'
    ) THEN
        ALTER TABLE v2_reports ADD COLUMN registry_data JSONB;

        RAISE NOTICE 'registry_data 컬럼 추가 완료';
    END IF;
END $$;

-- 2-3. user_id 컬럼 추가 (RLS용)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'v2_reports' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE v2_reports ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

        -- 기존 데이터 마이그레이션 (case_id → user_id)
        UPDATE v2_reports r
        SET user_id = c.user_id
        FROM v2_cases c
        WHERE r.case_id = c.id AND r.user_id IS NULL;

        RAISE NOTICE 'user_id 컬럼 추가 완료';
    END IF;
END $$;

-- 2-4. risk_score를 JSONB로 변경 가능하도록 risk_score_json 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'v2_reports' AND column_name = 'risk_score_json'
    ) THEN
        ALTER TABLE v2_reports ADD COLUMN risk_score_json JSONB;

        -- 기존 risk_score(INTEGER)를 JSON으로 변환
        UPDATE v2_reports
        SET risk_score_json = jsonb_build_object('total_score', risk_score)
        WHERE risk_score IS NOT NULL AND risk_score_json IS NULL;

        RAISE NOTICE 'risk_score_json 컬럼 추가 완료';
    END IF;
END $$;

-- ============================================
-- 3. v2_artifacts 테이블 수정
-- ============================================

-- 3-1. file_url 컬럼 추가 (Supabase Storage Public URL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'v2_artifacts' AND column_name = 'file_url'
    ) THEN
        ALTER TABLE v2_artifacts ADD COLUMN file_url TEXT;

        -- 기존 file_path를 file_url로 복사 (임시)
        UPDATE v2_artifacts
        SET file_url = file_path
        WHERE file_url IS NULL;

        RAISE NOTICE 'file_url 컬럼 추가 완료';
    END IF;
END $$;

-- ============================================
-- 4. 헬퍼 뷰 - 코드 호환용
-- ============================================

-- 4-1. 레거시 호환용 뷰 (기존 스키마 필드명 매핑)
CREATE OR REPLACE VIEW v2_cases_legacy AS
SELECT
    id,
    user_id,
    property_address as address_road,
    NULL::TEXT as address_lot,
    address_dong,
    address_ho,
    address_detail,
    contract_type,
    contract_amount,
    monthly_rent,
    current_state as state,
    flags,
    metadata,
    created_at,
    updated_at,
    completed_at
FROM v2_cases;

-- ============================================
-- 5. RLS 정책 업데이트 (v2_reports)
-- ============================================

-- 기존 정책 제거
DROP POLICY IF EXISTS "Users can view reports of their cases" ON v2_reports;

-- 새 정책 추가 (user_id 기반)
CREATE POLICY "Users can view their own reports"
    ON v2_reports FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================
-- 완료!
-- ============================================
-- 적용 방법:
-- 1. Supabase SQL Editor에서 실행
-- 2. 또는: supabase db push
--
-- 주의사항:
-- - 기존 address_road/state 컬럼은 백업용으로 보존
-- - 데이터 검증 후 수동으로 제거 가능
-- - 프로덕션 적용 전 스테이징에서 테스트 필수
-- ============================================
