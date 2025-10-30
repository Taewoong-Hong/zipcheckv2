-- ============================================
-- 집체크 v2 초기 스키마
-- ============================================
-- 작성일: 2025-01-30
-- 버전: 1.0.0
-- 설명: 기본 테이블 생성 (v2_profiles, v2_contracts, v2_documents, v2_embeddings)
-- ============================================

-- ============================================
-- 1. v2_profiles 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS v2_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL,  -- auth.users 참조
    name TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_v2_profiles_user_id ON v2_profiles(user_id);

-- RLS
ALTER TABLE v2_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
    ON v2_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON v2_profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- 2. v2_contracts 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS v2_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,  -- auth.users 참조
    contract_id TEXT UNIQUE NOT NULL,
    addr TEXT,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_v2_contracts_user_id ON v2_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_contracts_contract_id ON v2_contracts(contract_id);
CREATE INDEX IF NOT EXISTS idx_v2_contracts_created_at ON v2_contracts(created_at DESC);

-- RLS
ALTER TABLE v2_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contracts"
    ON v2_contracts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contracts"
    ON v2_contracts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contracts"
    ON v2_contracts FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- 3. v2_documents 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS v2_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL,
    user_id UUID NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'registry' CHECK (document_type IN ('registry', 'contract')),
    file_path TEXT,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    text TEXT,
    text_length INTEGER,
    property_address TEXT,
    owner_info JSONB DEFAULT '{}',
    registry_date DATE,
    registry_type TEXT CHECK (registry_type IN ('land', 'building', 'collective') OR registry_type IS NULL),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_contract FOREIGN KEY (contract_id) REFERENCES v2_contracts(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_v2_documents_contract_id ON v2_documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_v2_documents_user_id ON v2_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_documents_document_type ON v2_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_v2_documents_property_address ON v2_documents(property_address);
CREATE INDEX IF NOT EXISTS idx_v2_documents_registry_date ON v2_documents(registry_date);
CREATE INDEX IF NOT EXISTS idx_v2_documents_created_at ON v2_documents(created_at DESC);

-- RLS
ALTER TABLE v2_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view documents of their contracts"
    ON v2_documents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert documents for their contracts"
    ON v2_documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 4. v2_embeddings 테이블 (pgvector)
-- ============================================
-- pgvector extension 활성화
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS v2_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID NOT NULL,
    user_id UUID NOT NULL,
    embedding vector(1536),  -- text-embedding-3-small
    chunk_text TEXT,
    chunk_index INTEGER,
    chunk_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_document FOREIGN KEY (doc_id) REFERENCES v2_documents(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_v2_embeddings_doc_id ON v2_embeddings(doc_id);
CREATE INDEX IF NOT EXISTS idx_v2_embeddings_user_id ON v2_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_embeddings_created_at ON v2_embeddings(created_at DESC);

-- Vector 유사도 검색 인덱스 (HNSW)
CREATE INDEX IF NOT EXISTS idx_v2_embeddings_vector ON v2_embeddings
    USING hnsw (embedding vector_cosine_ops);

-- RLS
ALTER TABLE v2_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view embeddings of their documents"
    ON v2_embeddings FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================
-- 5. v2_reports 테이블 (기본 버전)
-- ============================================
CREATE TABLE IF NOT EXISTS v2_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL,
    user_id UUID NOT NULL,
    question TEXT,
    result_json JSONB,
    result_text TEXT,
    mode TEXT NOT NULL DEFAULT 'single' CHECK (mode IN ('single', 'consensus')),
    provider TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_contract_report FOREIGN KEY (contract_id) REFERENCES v2_contracts(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_v2_reports_contract_id ON v2_reports(contract_id);
CREATE INDEX IF NOT EXISTS idx_v2_reports_user_id ON v2_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_reports_created_at ON v2_reports(created_at DESC);

-- RLS
ALTER TABLE v2_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reports of their contracts"
    ON v2_reports FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================
-- 6. updated_at 트리거 함수
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- v2_profiles 트리거
CREATE TRIGGER update_v2_profiles_updated_at
    BEFORE UPDATE ON v2_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- v2_contracts 트리거
CREATE TRIGGER update_v2_contracts_updated_at
    BEFORE UPDATE ON v2_contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 완료!
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 001 완료: 기본 스키마 생성 완료';
  RAISE NOTICE '📋 생성된 테이블: v2_profiles, v2_contracts, v2_documents, v2_embeddings, v2_reports';
  RAISE NOTICE '🔒 RLS 정책 활성화됨';
END $$;
