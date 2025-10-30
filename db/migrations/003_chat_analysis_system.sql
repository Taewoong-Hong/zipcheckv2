-- ============================================
-- 집체크 v2 채팅 분석 시스템 스키마
-- ============================================
-- 작성일: 2025-01-27
-- 버전: 1.0.0
-- 설명: 부동산 계약 분석 시스템의 핵심 테이블
-- ============================================

-- ============================================
-- 1. 케이스 (분석 사례) 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS v2_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 주소 정보
    address_road TEXT NOT NULL,                    -- 도로명 주소 (암호화)
    address_lot TEXT,                              -- 지번 주소 (암호화)
    address_dong TEXT,                             -- 동
    address_ho TEXT,                               -- 호
    address_detail JSONB,                          -- 상세 주소 정보 (juso API 응답)

    -- 계약 정보
    contract_type TEXT NOT NULL CHECK (contract_type IN ('전세', '전월세', '월세', '매매')),
    contract_amount BIGINT,                        -- 계약금액 (보증금 or 매매가)
    monthly_rent BIGINT,                           -- 월세 (해당 시)

    -- 상태 추적
    state TEXT NOT NULL DEFAULT 'init' CHECK (state IN (
        'init',              -- S0. 초기화
        'address_pick',      -- S1. 주소 선택
        'contract_type',     -- S2. 계약 유형 선택
        'registry_choice',   -- S3. 등기부 선택
        'registry_ready',    -- S4. 등기부 준비 완료
        'parse_enrich',      -- S5. 파싱 및 데이터 수집
        'report',            -- S6. 리포트 생성 완료
        'error'              -- 에러 상태
    )),

    -- 메타데이터
    flags JSONB DEFAULT '{}',                      -- 플래그 (test_mode, skip_validation 등)
    metadata JSONB DEFAULT '{}',                   -- 기타 메타데이터

    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- 인덱스
    CONSTRAINT valid_contract_amount CHECK (contract_amount IS NULL OR contract_amount >= 0),
    CONSTRAINT valid_monthly_rent CHECK (monthly_rent IS NULL OR monthly_rent >= 0)
);

-- 인덱스 생성
CREATE INDEX idx_v2_cases_user_id ON v2_cases(user_id);
CREATE INDEX idx_v2_cases_state ON v2_cases(state);
CREATE INDEX idx_v2_cases_created_at ON v2_cases(created_at DESC);

-- RLS 정책
ALTER TABLE v2_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cases"
    ON v2_cases FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cases"
    ON v2_cases FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cases"
    ON v2_cases FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cases"
    ON v2_cases FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 2. 아티팩트 (파일/문서) 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS v2_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES v2_cases(id) ON DELETE CASCADE,

    -- 파일 정보
    artifact_type TEXT NOT NULL CHECK (artifact_type IN (
        'registry_pdf',      -- 등기부등본 PDF
        'building_ledger',   -- 건축물대장 PDF
        'user_upload',       -- 사용자 업로드 파일
        'generated_report'   -- 생성된 리포트 PDF
    )),

    -- 파일 경로 (Supabase Storage)
    file_path TEXT NOT NULL,                       -- Storage 경로
    file_name TEXT NOT NULL,                       -- 원본 파일명
    file_size BIGINT NOT NULL,                     -- 파일 크기 (bytes)
    mime_type TEXT NOT NULL,                       -- MIME 타입

    -- 파싱 정보
    parsed_data JSONB,                             -- 파싱된 데이터 (구조화된 JSON)
    parse_confidence REAL CHECK (parse_confidence BETWEEN 0 AND 1),  -- 파싱 신뢰도
    parse_method TEXT CHECK (parse_method IN ('pypdf', 'ocr', 'llm_gemini', 'llm_chatgpt')),

    -- 메타데이터
    metadata JSONB DEFAULT '{}',

    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_v2_artifacts_case_id ON v2_artifacts(case_id);
CREATE INDEX idx_v2_artifacts_type ON v2_artifacts(artifact_type);

-- RLS 정책
ALTER TABLE v2_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view artifacts of their cases"
    ON v2_artifacts FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM v2_cases
        WHERE v2_cases.id = v2_artifacts.case_id
        AND v2_cases.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert artifacts for their cases"
    ON v2_artifacts FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM v2_cases
        WHERE v2_cases.id = v2_artifacts.case_id
        AND v2_cases.user_id = auth.uid()
    ));

-- ============================================
-- 3. 리포트 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS v2_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES v2_cases(id) ON DELETE CASCADE,

    -- 리포트 버전
    version INTEGER NOT NULL DEFAULT 1,            -- 리포트 버전 (재생성 시 증가)

    -- 리포트 데이터 (표준 스키마)
    report_data JSONB NOT NULL,                    -- 전체 리포트 JSON (표준 스키마)

    -- 요약 (빠른 조회용)
    final_summary TEXT,                            -- 채팅형 요약 (5-8줄)
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),  -- 리스크 점수
    risk_band TEXT CHECK (risk_band IN ('LOW', 'MID', 'HIGH', 'VHIGH')),  -- 리스크 밴드

    -- LLM 추적
    llm_model_draft TEXT,                          -- 초안 생성 모델 (예: gpt-4o-mini)
    llm_model_review TEXT,                         -- 검증 모델 (예: claude-sonnet-4)
    llm_tokens_used INTEGER,                       -- 총 토큰 사용량

    -- 메타데이터
    generation_time_ms INTEGER,                    -- 생성 소요 시간 (ms)
    metadata JSONB DEFAULT '{}',

    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_v2_reports_case_id ON v2_reports(case_id);
CREATE INDEX idx_v2_reports_version ON v2_reports(case_id, version DESC);
CREATE INDEX idx_v2_reports_risk_band ON v2_reports(risk_band);

-- RLS 정책
ALTER TABLE v2_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reports of their cases"
    ON v2_reports FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM v2_cases
        WHERE v2_cases.id = v2_reports.case_id
        AND v2_cases.user_id = auth.uid()
    ));

-- ============================================
-- 4. 크레딧 트랜잭션 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS v2_credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES v2_cases(id) ON DELETE SET NULL,  -- 케이스와 연결 (선택)

    -- 트랜잭션 정보
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'purchase',          -- 크레딧 구매
        'deduct',            -- 크레딧 차감 (등기부 발급 등)
        'refund',            -- 환불 (실패 시)
        'bonus',             -- 보너스 지급
        'expire'             -- 만료
    )),

    -- 금액
    amount INTEGER NOT NULL,                       -- 크레딧 수량 (음수: 차감, 양수: 증가)
    balance_after INTEGER NOT NULL,                -- 트랜잭션 후 잔액

    -- 사유
    reason TEXT NOT NULL,                          -- 트랜잭션 사유
    reason_code TEXT,                              -- 사유 코드 (예: REGISTRY_ISSUE, RPA_FAILED)

    -- 메타데이터
    metadata JSONB DEFAULT '{}',                   -- 결제 정보, RPA 잡 ID 등

    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_v2_credit_txns_user_id ON v2_credit_transactions(user_id);
CREATE INDEX idx_v2_credit_txns_case_id ON v2_credit_transactions(case_id);
CREATE INDEX idx_v2_credit_txns_created_at ON v2_credit_transactions(created_at DESC);

-- RLS 정책
ALTER TABLE v2_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
    ON v2_credit_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================
-- 5. 감사 로그 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS v2_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    case_id UUID REFERENCES v2_cases(id) ON DELETE SET NULL,

    -- 이벤트 정보
    event_type TEXT NOT NULL,                      -- 이벤트 타입 (예: case_created, pdf_parsed)
    event_category TEXT CHECK (event_category IN (
        'case',              -- 케이스 관련
        'registry',          -- 등기부 관련
        'parsing',           -- 파싱 관련
        'data_collection',   -- 데이터 수집
        'llm',               -- LLM 호출
        'report',            -- 리포트 생성
        'credit',            -- 크레딧 관련
        'error'              -- 에러
    )),

    -- 상세 정보
    message TEXT NOT NULL,                         -- 이벤트 메시지
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),

    -- 메타데이터
    metadata JSONB DEFAULT '{}',                   -- 추가 정보 (API 응답, 에러 스택 등)

    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_v2_audit_logs_user_id ON v2_audit_logs(user_id);
CREATE INDEX idx_v2_audit_logs_case_id ON v2_audit_logs(case_id);
CREATE INDEX idx_v2_audit_logs_event_type ON v2_audit_logs(event_type);
CREATE INDEX idx_v2_audit_logs_created_at ON v2_audit_logs(created_at DESC);

-- RLS 정책 (관리자만 접근)
ALTER TABLE v2_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
    ON v2_audit_logs FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================
-- 6. 공공 데이터 캐시 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS v2_public_data_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 캐시 키
    data_type TEXT NOT NULL CHECK (data_type IN (
        'building_ledger',   -- 건축물대장
        'real_estate_trade', -- 실거래가
        'similar_property',  -- 유사 매물
        'auction'            -- 경매 낙찰가
    )),
    query_params JSONB NOT NULL,                   -- 쿼리 파라미터 (주소, 기간 등)
    query_hash TEXT NOT NULL UNIQUE,               -- 파라미터 해시 (캐시 키)

    -- 캐시 데이터
    data JSONB NOT NULL,                           -- 캐시된 데이터
    data_source TEXT NOT NULL,                     -- 데이터 출처 (예: 국토부 API)

    -- 메타데이터
    hit_count INTEGER NOT NULL DEFAULT 0,          -- 캐시 히트 횟수
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- 만료 시간

    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_v2_public_data_cache_type ON v2_public_data_cache(data_type);
CREATE INDEX idx_v2_public_data_cache_hash ON v2_public_data_cache(query_hash);
CREATE INDEX idx_v2_public_data_cache_expires ON v2_public_data_cache(expires_at);

-- 만료된 캐시 자동 삭제 함수
CREATE OR REPLACE FUNCTION delete_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM v2_public_data_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. 트리거 - updated_at 자동 갱신
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- v2_cases 트리거
CREATE TRIGGER update_v2_cases_updated_at
    BEFORE UPDATE ON v2_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- v2_artifacts 트리거
CREATE TRIGGER update_v2_artifacts_updated_at
    BEFORE UPDATE ON v2_artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. 헬퍼 함수 - 사용자 크레딧 잔액 조회
-- ============================================
CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO v_balance
    FROM v2_credit_transactions
    WHERE user_id = p_user_id;

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. 헬퍼 함수 - 크레딧 차감 (트랜잭션)
-- ============================================
CREATE OR REPLACE FUNCTION deduct_credits(
    p_user_id UUID,
    p_case_id UUID,
    p_amount INTEGER,
    p_reason TEXT,
    p_reason_code TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- 현재 잔액 조회
    v_current_balance := get_user_credit_balance(p_user_id);

    -- 잔액 부족 체크
    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient credits: current=%, required=%', v_current_balance, p_amount;
    END IF;

    -- 새 잔액 계산
    v_new_balance := v_current_balance - p_amount;

    -- 트랜잭션 기록
    INSERT INTO v2_credit_transactions (
        user_id,
        case_id,
        transaction_type,
        amount,
        balance_after,
        reason,
        reason_code,
        metadata
    ) VALUES (
        p_user_id,
        p_case_id,
        'deduct',
        -p_amount,
        v_new_balance,
        p_reason,
        p_reason_code,
        p_metadata
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. 헬퍼 함수 - 크레딧 환불
-- ============================================
CREATE OR REPLACE FUNCTION refund_credits(
    p_user_id UUID,
    p_case_id UUID,
    p_amount INTEGER,
    p_reason TEXT,
    p_reason_code TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- 현재 잔액 조회
    v_current_balance := get_user_credit_balance(p_user_id);
    v_new_balance := v_current_balance + p_amount;

    -- 트랜잭션 기록
    INSERT INTO v2_credit_transactions (
        user_id,
        case_id,
        transaction_type,
        amount,
        balance_after,
        reason,
        reason_code,
        metadata
    ) VALUES (
        p_user_id,
        p_case_id,
        'refund',
        p_amount,
        v_new_balance,
        p_reason,
        p_reason_code,
        p_metadata
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. 헬퍼 함수 - 감사 로그 기록
-- ============================================
CREATE OR REPLACE FUNCTION log_audit(
    p_user_id UUID,
    p_case_id UUID,
    p_event_type TEXT,
    p_event_category TEXT,
    p_message TEXT,
    p_severity TEXT DEFAULT 'info',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO v2_audit_logs (
        user_id,
        case_id,
        event_type,
        event_category,
        message,
        severity,
        metadata
    ) VALUES (
        p_user_id,
        p_case_id,
        p_event_type,
        p_event_category,
        p_message,
        p_severity,
        p_metadata
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 완료!
-- ============================================
-- 실행 순서:
-- 1. 이 파일을 Supabase SQL Editor에서 실행
-- 2. 또는 migration 도구로 적용:
--    supabase db push
--
-- Note: 웰컴 크레딧 트리거는 migration 006에서 추가됩니다
-- ============================================
