-- ============================================
-- ZipCheck v2 Database Schema
-- Supabase PostgreSQL + pgvector
-- ============================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- NOTE: v2 스키마 분리
-- 기존 v1 테이블과 충돌 방지를 위해 모든 테이블명에 v2_ prefix 사용
-- ============================================

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
-- Table: contracts
-- 계약서 메타데이터
-- ============================================
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contract_id TEXT NOT NULL UNIQUE,
    addr TEXT,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE contracts IS '계약서 메타데이터';
COMMENT ON COLUMN contracts.contract_id IS '계약서 고유 ID (사용자 제공)';
COMMENT ON COLUMN contracts.addr IS '부동산 주소';
COMMENT ON COLUMN contracts.status IS '처리 상태: processing, completed, failed';

CREATE INDEX idx_contracts_user_id ON contracts(user_id);
CREATE INDEX idx_contracts_contract_id ON contracts(contract_id);
CREATE INDEX idx_contracts_created_at ON contracts(created_at DESC);

-- ============================================
-- Table: documents
-- 문서 원본 및 텍스트
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_path TEXT,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    text TEXT,
    text_length INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE documents IS '문서 원본 및 추출된 텍스트';
COMMENT ON COLUMN documents.file_path IS '파일 저장 경로 (Supabase Storage 또는 로컬)';
COMMENT ON COLUMN documents.text IS 'PDF에서 추출된 전체 텍스트';
COMMENT ON COLUMN documents.text_length IS '텍스트 길이 (문자 수)';

CREATE INDEX idx_documents_contract_id ON documents(contract_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);

-- ============================================
-- Table: embeddings
-- 벡터 임베딩 (pgvector)
-- ============================================
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    embedding vector(3072),  -- text-embedding-3-large dimension
    chunk_text TEXT,
    chunk_index INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE embeddings IS '벡터 임베딩 (pgvector)';
COMMENT ON COLUMN embeddings.embedding IS 'OpenAI text-embedding-3-large (3072 dimensions)';
COMMENT ON COLUMN embeddings.chunk_text IS '임베딩된 텍스트 청크';
COMMENT ON COLUMN embeddings.chunk_index IS '문서 내 청크 순서';
COMMENT ON COLUMN embeddings.metadata IS '추가 메타데이터 (페이지, 오프셋 등)';

-- IVFFlat index for vector similarity search
CREATE INDEX idx_embeddings_vector ON embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_embeddings_doc_id ON embeddings(doc_id);
CREATE INDEX idx_embeddings_user_id ON embeddings(user_id);
CREATE INDEX idx_embeddings_created_at ON embeddings(created_at DESC);

-- ============================================
-- Table: reports
-- 분석 리포트
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question TEXT,
    result_json JSONB,
    result_text TEXT,
    mode TEXT DEFAULT 'single' CHECK (mode IN ('single', 'consensus')),
    provider TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE reports IS '계약서 분석 리포트';
COMMENT ON COLUMN reports.result_json IS '구조화된 분석 결과 (JSON)';
COMMENT ON COLUMN reports.result_text IS '분석 결과 텍스트';
COMMENT ON COLUMN reports.mode IS '분석 모드: single 또는 consensus';
COMMENT ON COLUMN reports.provider IS 'LLM 제공자: openai 또는 claude';

CREATE INDEX idx_reports_contract_id ON reports(contract_id);
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only access their own profile
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Contracts: Users can only access their own contracts
CREATE POLICY "Users can view their own contracts"
    ON contracts FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own contracts"
    ON contracts FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own contracts"
    ON contracts FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own contracts"
    ON contracts FOR DELETE
    USING (user_id = auth.uid());

-- Documents: Users can only access their own documents
CREATE POLICY "Users can view their own documents"
    ON documents FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own documents"
    ON documents FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own documents"
    ON documents FOR DELETE
    USING (user_id = auth.uid());

-- Embeddings: Users can only access their own embeddings
CREATE POLICY "Users can view their own embeddings"
    ON embeddings FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own embeddings"
    ON embeddings FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own embeddings"
    ON embeddings FOR DELETE
    USING (user_id = auth.uid());

-- Reports: Users can only access their own reports
CREATE POLICY "Users can view their own reports"
    ON reports FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own reports"
    ON reports FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own reports"
    ON reports FOR DELETE
    USING (user_id = auth.uid());

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at for profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update updated_at for contracts
CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Sample Data (Optional - for development)
-- ============================================

-- Note: Insert sample data only in development environment
-- This section should be removed or commented out in production

-- Example: Insert a test profile (requires valid auth.users entry)
-- INSERT INTO profiles (user_id, name, email)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'Test User', 'test@example.com')
-- ON CONFLICT (user_id) DO NOTHING;
