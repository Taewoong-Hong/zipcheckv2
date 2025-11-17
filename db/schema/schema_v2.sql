-- ============================================
-- ZipCheck v2 Database Schema
-- Supabase PostgreSQL + pgvector
-- ============================================
-- NOTE: v2 스키마 분리 전략
-- 기존 v1 서비스가 사용 중인 Supabase 프로젝트에서
-- v1 테이블과 충돌하지 않도록 모든 테이블명에 v2_ prefix 사용
-- ============================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Table: v2_profiles
-- 사용자 프로필 (v2)
-- ============================================
CREATE TABLE IF NOT EXISTS v2_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE v2_profiles IS 'v2 사용자 프로필';
COMMENT ON COLUMN v2_profiles.user_id IS 'Supabase Auth user ID';

-- ============================================
-- Table: v2_contracts
-- 계약서 메타데이터 (v2)
-- ============================================
CREATE TABLE IF NOT EXISTS v2_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contract_id TEXT NOT NULL UNIQUE,
    addr TEXT,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE v2_contracts IS 'v2 계약서 메타데이터';
COMMENT ON COLUMN v2_contracts.contract_id IS '계약서 고유 ID (사용자 제공)';
COMMENT ON COLUMN v2_contracts.addr IS '부동산 주소';
COMMENT ON COLUMN v2_contracts.status IS '처리 상태: processing, completed, failed';

CREATE INDEX idx_v2_contracts_user_id ON v2_contracts(user_id);
CREATE INDEX idx_v2_contracts_contract_id ON v2_contracts(contract_id);
CREATE INDEX idx_v2_contracts_created_at ON v2_contracts(created_at DESC);

-- ============================================
-- Table: v2_documents
-- 문서 원본 및 텍스트 (v2)
-- ============================================
CREATE TABLE IF NOT EXISTS v2_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES v2_contracts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_type TEXT DEFAULT 'registry' CHECK (document_type IN ('registry', 'contract')),
    file_path TEXT,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    text TEXT,
    text_length INTEGER,
    property_address TEXT,
    owner_info JSONB DEFAULT '{}'::jsonb,
    registry_date DATE,
    registry_type TEXT CHECK (registry_type IN ('land', 'building', 'collective')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE v2_documents IS 'v2 문서 원본 및 추출된 텍스트 (등기부등본/계약서)';
COMMENT ON COLUMN v2_documents.document_type IS '문서 유형: registry (등기부등본) 또는 contract (계약서)';
COMMENT ON COLUMN v2_documents.file_path IS '파일 저장 경로 (Supabase Storage 또는 로컬)';
COMMENT ON COLUMN v2_documents.text IS 'PDF에서 추출된 전체 텍스트';
COMMENT ON COLUMN v2_documents.text_length IS '텍스트 길이 (문자 수)';
COMMENT ON COLUMN v2_documents.property_address IS '등기부상 부동산 주소 (소재지)';
COMMENT ON COLUMN v2_documents.owner_info IS '소유자 정보 (JSON): {name, share, acquisition_date, etc.}';
COMMENT ON COLUMN v2_documents.registry_date IS '등기부등본 발급일자';
COMMENT ON COLUMN v2_documents.registry_type IS '등기부 유형: land (토지), building (건물), collective (집합건물)';

CREATE INDEX idx_v2_documents_contract_id ON v2_documents(contract_id);
CREATE INDEX idx_v2_documents_user_id ON v2_documents(user_id);
CREATE INDEX idx_v2_documents_created_at ON v2_documents(created_at DESC);
CREATE INDEX idx_v2_documents_document_type ON v2_documents(document_type);
CREATE INDEX idx_v2_documents_property_address ON v2_documents(property_address);
CREATE INDEX idx_v2_documents_registry_date ON v2_documents(registry_date DESC);

-- ============================================
-- Table: v2_embeddings
-- 벡터 임베딩 (pgvector) (v2)
-- ============================================
CREATE TABLE IF NOT EXISTS v2_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES v2_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    embedding vector(1536),  -- text-embedding-3-small dimension (compatible with pgvector < 0.6.0)
    chunk_text TEXT,
    chunk_index INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE v2_embeddings IS 'v2 벡터 임베딩 (pgvector)';
COMMENT ON COLUMN v2_embeddings.embedding IS 'OpenAI text-embedding-3-small (1536 dimensions)';
COMMENT ON COLUMN v2_embeddings.chunk_text IS '임베딩된 텍스트 청크';
COMMENT ON COLUMN v2_embeddings.chunk_index IS '문서 내 청크 순서';
COMMENT ON COLUMN v2_embeddings.metadata IS '추가 메타데이터 (페이지, 오프셋 등)';

-- HNSW index for vector similarity search (1536 dimensions supported)
CREATE INDEX idx_v2_embeddings_vector ON v2_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_v2_embeddings_doc_id ON v2_embeddings(doc_id);
CREATE INDEX idx_v2_embeddings_user_id ON v2_embeddings(user_id);
CREATE INDEX idx_v2_embeddings_created_at ON v2_embeddings(created_at DESC);

-- ============================================
-- Table: v2_reports
-- 분석 리포트 (v2)
-- ============================================
CREATE TABLE IF NOT EXISTS v2_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES v2_contracts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question TEXT,
    result_json JSONB,
    result_text TEXT,
    mode TEXT DEFAULT 'single' CHECK (mode IN ('single', 'consensus')),
    provider TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE v2_reports IS 'v2 계약서 분석 리포트';
COMMENT ON COLUMN v2_reports.result_json IS '구조화된 분석 결과 (JSON)';
COMMENT ON COLUMN v2_reports.result_text IS '분석 결과 텍스트';
COMMENT ON COLUMN v2_reports.mode IS '분석 모드: single 또는 consensus';
COMMENT ON COLUMN v2_reports.provider IS 'LLM 제공자: openai 또는 claude';

CREATE INDEX idx_v2_reports_contract_id ON v2_reports(contract_id);
CREATE INDEX idx_v2_reports_user_id ON v2_reports(user_id);
CREATE INDEX idx_v2_reports_created_at ON v2_reports(created_at DESC);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all v2 tables
ALTER TABLE v2_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_reports ENABLE ROW LEVEL SECURITY;

-- v2_profiles: Users can only access their own profile
CREATE POLICY "v2_users_can_view_own_profile"
    ON v2_profiles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "v2_users_can_insert_own_profile"
    ON v2_profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "v2_users_can_update_own_profile"
    ON v2_profiles FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- v2_contracts: Users can only access their own contracts
CREATE POLICY "v2_users_can_view_own_contracts"
    ON v2_contracts FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "v2_users_can_insert_own_contracts"
    ON v2_contracts FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "v2_users_can_update_own_contracts"
    ON v2_contracts FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "v2_users_can_delete_own_contracts"
    ON v2_contracts FOR DELETE
    USING (user_id = auth.uid());

-- v2_documents: Users can only access their own documents
CREATE POLICY "v2_users_can_view_own_documents"
    ON v2_documents FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "v2_users_can_insert_own_documents"
    ON v2_documents FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "v2_users_can_delete_own_documents"
    ON v2_documents FOR DELETE
    USING (user_id = auth.uid());

-- v2_embeddings: Users can only access their own embeddings
CREATE POLICY "v2_users_can_view_own_embeddings"
    ON v2_embeddings FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "v2_users_can_insert_own_embeddings"
    ON v2_embeddings FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "v2_users_can_delete_own_embeddings"
    ON v2_embeddings FOR DELETE
    USING (user_id = auth.uid());

-- v2_reports: Users can only access their own reports
CREATE POLICY "v2_users_can_view_own_reports"
    ON v2_reports FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "v2_users_can_insert_own_reports"
    ON v2_reports FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "v2_users_can_delete_own_reports"
    ON v2_reports FOR DELETE
    USING (user_id = auth.uid());

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function: Update updated_at timestamp (v2)
CREATE OR REPLACE FUNCTION v2_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at for v2_profiles
CREATE TRIGGER v2_update_profiles_updated_at
    BEFORE UPDATE ON v2_profiles
    FOR EACH ROW
    EXECUTE FUNCTION v2_update_updated_at_column();

-- Trigger: Auto-update updated_at for v2_contracts
CREATE TRIGGER v2_update_contracts_updated_at
    BEFORE UPDATE ON v2_contracts
    FOR EACH ROW
    EXECUTE FUNCTION v2_update_updated_at_column();

-- ============================================
-- Data Isolation from v1
-- ============================================
-- NOTE: v1과 v2 데이터는 완전히 분리됩니다:
-- - user_id는 auth.users를 공유하지만, 데이터는 별도 테이블 사용
-- - v1_contracts, v1_reports 등은 그대로 유지
-- - v2_contracts, v2_reports 등은 새로 생성
-- - RLS 정책도 각각 독립적으로 적용
-- ============================================
