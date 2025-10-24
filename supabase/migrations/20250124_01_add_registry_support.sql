-- ============================================
-- Migration: Add Registry Support to v2_documents
-- Date: 2025-01-24
-- Description: 등기부등본 지원 추가 - document_type 및 메타데이터 컬럼 추가
-- ============================================

-- 1. v2_documents 테이블에 document_type 컬럼 추가
ALTER TABLE v2_documents
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'registry'
  CHECK (document_type IN ('registry', 'contract'));

COMMENT ON COLUMN v2_documents.document_type IS '문서 유형: registry (등기부등본) 또는 contract (계약서)';

-- 2. 등기부등본 관련 메타데이터 컬럼 추가
ALTER TABLE v2_documents
ADD COLUMN IF NOT EXISTS property_address TEXT,
ADD COLUMN IF NOT EXISTS owner_info JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS registry_date DATE,
ADD COLUMN IF NOT EXISTS registry_type TEXT CHECK (registry_type IN ('land', 'building', 'collective'));

COMMENT ON COLUMN v2_documents.property_address IS '등기부상 부동산 주소 (소재지)';
COMMENT ON COLUMN v2_documents.owner_info IS '소유자 정보 (JSON): {name, share, acquisition_date, etc.}';
COMMENT ON COLUMN v2_documents.registry_date IS '등기부등본 발급일자';
COMMENT ON COLUMN v2_documents.registry_type IS '등기부 유형: land (토지), building (건물), collective (집합건물)';

-- 3. 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_v2_documents_document_type ON v2_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_v2_documents_property_address ON v2_documents(property_address);
CREATE INDEX IF NOT EXISTS idx_v2_documents_registry_date ON v2_documents(registry_date DESC);

-- 4. 기존 데이터 업데이트 (있다면 기본값을 'contract'로 설정)
-- 주의: 실제 운영 환경에서는 데이터 확인 후 적절한 값으로 업데이트 필요
UPDATE v2_documents
SET document_type = 'contract'
WHERE document_type IS NULL;

-- ============================================
-- Verification Queries (마이그레이션 검증용)
-- ============================================
-- 실행 후 아래 쿼리로 검증 가능:
--
-- 1. 컬럼 추가 확인:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'v2_documents'
-- ORDER BY ordinal_position;
--
-- 2. 인덱스 확인:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'v2_documents';
--
-- 3. 제약조건 확인:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'v2_documents'::regclass;
-- ============================================
