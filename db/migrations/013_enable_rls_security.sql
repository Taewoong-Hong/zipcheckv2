-- ============================================
-- Migration: Enable Row Level Security (RLS)
-- Date: 2025-01-24
-- Description: 모든 테이블에 RLS 활성화 및 보안 정책 설정
-- ============================================

-- 1. v2_documents 테이블 RLS 활성화
ALTER TABLE v2_documents ENABLE ROW LEVEL SECURITY;

-- 2. v2_documents 정책 생성
-- 2.1. 사용자는 자신의 문서만 조회 가능
CREATE POLICY "Users can view own documents"
ON v2_documents
FOR SELECT
USING (auth.uid() = user_id);

-- 2.2. 사용자는 자신의 문서만 생성 가능
CREATE POLICY "Users can create own documents"
ON v2_documents
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 2.3. 사용자는 자신의 문서만 수정 가능
CREATE POLICY "Users can update own documents"
ON v2_documents
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2.4. 사용자는 자신의 문서만 삭제 가능
CREATE POLICY "Users can delete own documents"
ON v2_documents
FOR DELETE
USING (auth.uid() = user_id);

-- 3. v2_embeddings 테이블이 존재하면 RLS 활성화
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'v2_embeddings'
  ) THEN
    ALTER TABLE v2_embeddings ENABLE ROW LEVEL SECURITY;

    -- v2_embeddings 정책: 문서 소유자만 접근 가능
    CREATE POLICY "Users can view embeddings of own documents"
    ON v2_embeddings
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM v2_documents
        WHERE v2_documents.id = v2_embeddings.doc_id
        AND v2_documents.user_id = auth.uid()
      )
    );

    CREATE POLICY "Users can insert embeddings for own documents"
    ON v2_embeddings
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM v2_documents
        WHERE v2_documents.id = v2_embeddings.doc_id
        AND v2_documents.user_id = auth.uid()
      )
    );

    CREATE POLICY "Users can delete embeddings of own documents"
    ON v2_embeddings
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM v2_documents
        WHERE v2_documents.id = v2_embeddings.doc_id
        AND v2_documents.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- 4. v2_reports 테이블이 존재하면 RLS 활성화
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'v2_reports'
  ) THEN
    ALTER TABLE v2_reports ENABLE ROW LEVEL SECURITY;

    -- v2_reports 정책: 보고서 소유자만 접근 가능
    CREATE POLICY "Users can view own reports"
    ON v2_reports
    FOR SELECT
    USING (auth.uid() = user_id);

    CREATE POLICY "Users can create own reports"
    ON v2_reports
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can delete own reports"
    ON v2_reports
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. 관리자 정책 추가 (is_admin 메타데이터가 true인 경우)
-- 5.1. 관리자는 모든 문서 조회 가능 (관리 목적)
CREATE POLICY "Admins can view all documents"
ON v2_documents
FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
);

-- 5.2. 관리자는 모든 문서 삭제 가능 (관리 목적)
CREATE POLICY "Admins can delete all documents"
ON v2_documents
FOR DELETE
USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
);

-- ============================================
-- Service Role 접근 정책 (백엔드 서비스용)
-- ============================================
-- Note: Service Role은 RLS를 우회할 수 있으므로 백엔드에서만 사용
-- 프론트엔드에서는 절대 Service Role Key를 사용하지 말 것!

-- ============================================
-- 검증 쿼리
-- ============================================
-- RLS 활성화 확인:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename LIKE 'v2_%';
--
-- 정책 확인:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename LIKE 'v2_%';
-- ============================================

-- 6. 코멘트 추가
COMMENT ON POLICY "Users can view own documents" ON v2_documents IS
  '사용자는 자신이 소유한 문서만 조회할 수 있습니다.';

COMMENT ON POLICY "Users can create own documents" ON v2_documents IS
  '사용자는 자신의 user_id로만 문서를 생성할 수 있습니다.';

COMMENT ON POLICY "Admins can view all documents" ON v2_documents IS
  '관리자는 모든 문서를 조회할 수 있습니다 (관리 및 지원 목적).';
