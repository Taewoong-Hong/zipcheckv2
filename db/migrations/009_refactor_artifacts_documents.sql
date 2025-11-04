-- ============================================
-- Migration 009: Artifacts/Documents 레이어 분리
-- ============================================
-- 목적:
--   1. v2_documents → v2_doc_texts 리네임 (텍스트/지식 레이어)
--   2. v2_artifacts 보강 (파일 원본 레이어)
--   3. v2_artifact_docs 연결 테이블 생성 (N:N 관계)
--   4. v2_embeddings 참조 업데이트
-- ============================================

BEGIN;

-- ============================================
-- Step 1: v2_documents → v2_doc_texts 리네임
-- ============================================
ALTER TABLE IF EXISTS v2_documents RENAME TO v2_doc_texts;

-- 인덱스 리네임
ALTER INDEX IF EXISTS idx_v2_documents_contract_id RENAME TO idx_v2_doc_texts_contract_id;
ALTER INDEX IF EXISTS idx_v2_documents_user_id RENAME TO idx_v2_doc_texts_user_id;
ALTER INDEX IF EXISTS idx_v2_documents_created_at RENAME TO idx_v2_doc_texts_created_at;
ALTER INDEX IF EXISTS idx_v2_documents_document_type RENAME TO idx_v2_doc_texts_document_type;
ALTER INDEX IF EXISTS idx_v2_documents_property_address RENAME TO idx_v2_doc_texts_property_address;
ALTER INDEX IF EXISTS idx_v2_documents_registry_date RENAME TO idx_v2_doc_texts_registry_date;

-- ============================================
-- Step 2: v2_doc_texts에 source 필드 추가
-- ============================================
ALTER TABLE v2_doc_texts
ADD COLUMN IF NOT EXISTS source_kind TEXT CHECK (source_kind IN ('artifact', 'manual', 'api', 'migration')),
ADD COLUMN IF NOT EXISTS source_ref_id UUID,
ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'ko',
ADD COLUMN IF NOT EXISTS page_range TEXT,
ADD COLUMN IF NOT EXISTS section_label TEXT,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 기본값 설정 (기존 데이터 마이그레이션)
UPDATE v2_doc_texts
SET source_kind = 'migration'
WHERE source_kind IS NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_v2_doc_texts_source ON v2_doc_texts(source_kind, source_ref_id);
CREATE INDEX IF NOT EXISTS idx_v2_doc_texts_gin_owner_info ON v2_doc_texts USING gin (owner_info);
CREATE INDEX IF NOT EXISTS idx_v2_doc_texts_gin_text ON v2_doc_texts USING gin (to_tsvector('simple', text));

COMMENT ON TABLE v2_doc_texts IS 'v2 텍스트/지식 레이어 - RAG·임베딩 대상 정규화된 텍스트';
COMMENT ON COLUMN v2_doc_texts.source_kind IS '소스 종류: artifact (파일 파싱), manual (사용자 입력), api (외부 API), migration (기존 데이터)';
COMMENT ON COLUMN v2_doc_texts.source_ref_id IS '소스 참조 ID (예: v2_artifacts.id)';
COMMENT ON COLUMN v2_doc_texts.lang IS '언어 코드 (ko, en 등)';
COMMENT ON COLUMN v2_doc_texts.page_range IS '페이지 범위 (예: 1-3)';
COMMENT ON COLUMN v2_doc_texts.section_label IS '섹션 라벨 (예: 갑구, 을구)';
COMMENT ON COLUMN v2_doc_texts.version IS '파싱 버전';

-- ============================================
-- Step 3: v2_artifacts 보강
-- ============================================
ALTER TABLE v2_artifacts
ADD COLUMN IF NOT EXISTS hash_sha256 TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 인덱스 추가
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_artifacts_hash_unique ON v2_artifacts(hash_sha256) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_v2_artifacts_user_id ON v2_artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_artifacts_deleted_at ON v2_artifacts(deleted_at) WHERE deleted_at IS NOT NULL;

-- file_url 컬럼 추가 (Storage URL 저장용)
ALTER TABLE v2_artifacts
ADD COLUMN IF NOT EXISTS file_url TEXT;

COMMENT ON COLUMN v2_artifacts.hash_sha256 IS 'SHA-256 해시 (중복 파일 방지)';
COMMENT ON COLUMN v2_artifacts.deleted_at IS '소프트 삭제 타임스탬프';
COMMENT ON COLUMN v2_artifacts.created_by IS '생성자 user_id';
COMMENT ON COLUMN v2_artifacts.user_id IS '소유자 user_id (RLS용)';
COMMENT ON COLUMN v2_artifacts.file_url IS 'Supabase Storage 서명 URL';

-- ============================================
-- Step 4: v2_artifact_docs 연결 테이블 생성 (N:N)
-- ============================================
CREATE TABLE IF NOT EXISTS v2_artifact_docs (
    artifact_id UUID NOT NULL REFERENCES v2_artifacts(id) ON DELETE CASCADE,
    doc_id UUID NOT NULL REFERENCES v2_doc_texts(id) ON DELETE CASCADE,
    relation TEXT CHECK (relation IN ('derived', 'updated_from', 'ocr_failed', 'manual_link')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (artifact_id, doc_id)
);

CREATE INDEX IF NOT EXISTS idx_v2_artifact_docs_doc_id ON v2_artifact_docs(doc_id);
CREATE INDEX IF NOT EXISTS idx_v2_artifact_docs_relation ON v2_artifact_docs(relation);

COMMENT ON TABLE v2_artifact_docs IS 'v2 파일(artifact)과 문서(doc_texts) 간 N:N 연결';
COMMENT ON COLUMN v2_artifact_docs.relation IS '관계 타입: derived (파싱), updated_from (업데이트), ocr_failed (OCR 실패), manual_link (수동 연결)';

-- ============================================
-- Step 5: v2_embeddings 외래키 업데이트 (테이블이 있는 경우만)
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'v2_embeddings'
    ) THEN
        -- 기존 외래키 제거
        ALTER TABLE v2_embeddings
        DROP CONSTRAINT IF EXISTS v2_embeddings_doc_id_fkey;

        -- 새 외래키 추가 (v2_doc_texts 참조)
        ALTER TABLE v2_embeddings
        ADD CONSTRAINT v2_embeddings_doc_id_fkey
        FOREIGN KEY (doc_id) REFERENCES v2_doc_texts(id) ON DELETE CASCADE;

        COMMENT ON COLUMN v2_embeddings.doc_id IS 'v2_doc_texts 참조 (텍스트 레이어)';

        RAISE NOTICE 'v2_embeddings 외래키 업데이트 완료';
    ELSE
        RAISE NOTICE 'v2_embeddings 테이블이 존재하지 않아 스킵합니다';
    END IF;
END $$;

-- ============================================
-- Step 6: RLS 정책 업데이트
-- ============================================

-- v2_doc_texts RLS (기존 v2_documents 정책 유지)
ALTER TABLE v2_doc_texts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own documents" ON v2_doc_texts;
CREATE POLICY "Users can view their own doc_texts"
    ON v2_doc_texts FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON v2_doc_texts;
CREATE POLICY "Users can insert their own doc_texts"
    ON v2_doc_texts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON v2_doc_texts;
CREATE POLICY "Users can update their own doc_texts"
    ON v2_doc_texts FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON v2_doc_texts;
CREATE POLICY "Users can delete their own doc_texts"
    ON v2_doc_texts FOR DELETE
    USING (auth.uid() = user_id);

-- v2_artifact_docs RLS
ALTER TABLE v2_artifact_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view artifact_docs of their cases"
    ON v2_artifact_docs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM v2_artifacts a
        JOIN v2_cases c ON c.id = a.case_id
        WHERE a.id = v2_artifact_docs.artifact_id
        AND c.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert artifact_docs for their cases"
    ON v2_artifact_docs FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM v2_artifacts a
        JOIN v2_cases c ON c.id = a.case_id
        WHERE a.id = v2_artifact_docs.artifact_id
        AND c.user_id = auth.uid()
    ));

-- ============================================
-- Step 7: 기존 데이터 마이그레이션
-- ============================================
-- v2_artifacts의 user_id 채우기 (case_id를 통해)
UPDATE v2_artifacts a
SET user_id = c.user_id
FROM v2_cases c
WHERE a.case_id = c.id
AND a.user_id IS NULL;

COMMIT;

-- ============================================
-- 롤백 스크립트 (필요 시 사용)
-- ============================================
/*
BEGIN;

-- v2_artifact_docs 삭제
DROP TABLE IF EXISTS v2_artifact_docs CASCADE;

-- v2_artifacts 컬럼 제거
ALTER TABLE v2_artifacts
DROP COLUMN IF EXISTS hash_sha256,
DROP COLUMN IF EXISTS deleted_at,
DROP COLUMN IF EXISTS created_by,
DROP COLUMN IF EXISTS user_id,
DROP COLUMN IF EXISTS file_url;

-- v2_doc_texts → v2_documents 리네임
ALTER TABLE v2_doc_texts RENAME TO v2_documents;

-- 인덱스 리네임
ALTER INDEX idx_v2_doc_texts_contract_id RENAME TO idx_v2_documents_contract_id;
ALTER INDEX idx_v2_doc_texts_user_id RENAME TO idx_v2_documents_user_id;
ALTER INDEX idx_v2_doc_texts_created_at RENAME TO idx_v2_documents_created_at;
ALTER INDEX idx_v2_doc_texts_document_type RENAME TO idx_v2_documents_document_type;
ALTER INDEX idx_v2_doc_texts_property_address RENAME TO idx_v2_documents_property_address;
ALTER INDEX idx_v2_doc_texts_registry_date RENAME TO idx_v2_documents_registry_date;

-- v2_doc_texts 추가 컬럼 제거
ALTER TABLE v2_documents
DROP COLUMN IF EXISTS source_kind,
DROP COLUMN IF EXISTS source_ref_id,
DROP COLUMN IF EXISTS lang,
DROP COLUMN IF EXISTS page_range,
DROP COLUMN IF EXISTS section_label,
DROP COLUMN IF EXISTS version,
DROP COLUMN IF EXISTS updated_at;

-- v2_embeddings 외래키 복구
ALTER TABLE v2_embeddings
DROP CONSTRAINT IF EXISTS v2_embeddings_doc_id_fkey;

ALTER TABLE v2_embeddings
ADD CONSTRAINT v2_embeddings_doc_id_fkey
FOREIGN KEY (doc_id) REFERENCES v2_documents(id) ON DELETE CASCADE;

COMMIT;
*/
