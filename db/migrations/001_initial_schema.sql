-- ============================================
-- Migration: 001_initial_schema
-- Description: Initial database schema for ZipCheck v2
-- Date: 2024-10-17
-- ============================================

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contract_id TEXT NOT NULL UNIQUE,
    addr TEXT,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contracts_user_id ON contracts(user_id);
CREATE INDEX idx_contracts_contract_id ON contracts(contract_id);
CREATE INDEX idx_contracts_created_at ON contracts(created_at DESC);

-- Step 4: Create documents table
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

CREATE INDEX idx_documents_contract_id ON documents(contract_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);

-- Step 5: Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    embedding vector(3072),
    chunk_text TEXT,
    chunk_index INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Create vector index for similarity search
CREATE INDEX idx_embeddings_vector ON embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_embeddings_doc_id ON embeddings(doc_id);
CREATE INDEX idx_embeddings_user_id ON embeddings(user_id);
CREATE INDEX idx_embeddings_created_at ON embeddings(created_at DESC);

-- Step 7: Create reports table
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

CREATE INDEX idx_reports_contract_id ON reports(contract_id);
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- Step 8: Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS Policies for profiles
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

-- Step 10: Create RLS Policies for contracts
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

-- Step 11: Create RLS Policies for documents
CREATE POLICY "Users can view their own documents"
    ON documents FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own documents"
    ON documents FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own documents"
    ON documents FOR DELETE
    USING (user_id = auth.uid());

-- Step 12: Create RLS Policies for embeddings
CREATE POLICY "Users can view their own embeddings"
    ON embeddings FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own embeddings"
    ON embeddings FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own embeddings"
    ON embeddings FOR DELETE
    USING (user_id = auth.uid());

-- Step 13: Create RLS Policies for reports
CREATE POLICY "Users can view their own reports"
    ON reports FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own reports"
    ON reports FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own reports"
    ON reports FOR DELETE
    USING (user_id = auth.uid());

-- Step 14: Create helper function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 15: Create triggers for auto-updating timestamps
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Migration completed successfully
