-- ============================================
-- Migration: Storage Security Policies
-- Date: 2025-01-24
-- Description: Storage 버킷 보안 정책 설정 (파일 업로드/다운로드 제어)
-- ============================================

-- 1. documents 버킷 생성 (존재하지 않는 경우)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,  -- ⚠️ 중요: 비공개 버킷 (공개 접근 금지)
  52428800,  -- 50MB 제한
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

-- 2. Storage 정책: 사용자는 자신의 폴더에만 업로드 가능
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
);

-- 3. Storage 정책: 사용자는 자신의 파일만 조회 가능
CREATE POLICY "Users can view own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
);

-- 4. Storage 정책: 사용자는 자신의 파일만 업데이트 가능
CREATE POLICY "Users can update own files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
);

-- 5. Storage 정책: 사용자는 자신의 파일만 삭제 가능
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
);

-- 6. 관리자 정책: 관리자는 모든 파일 조회 가능 (관리 목적)
CREATE POLICY "Admins can view all files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents'
  AND (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
);

-- 7. 관리자 정책: 관리자는 모든 파일 삭제 가능 (관리 목적)
CREATE POLICY "Admins can delete all files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents'
  AND (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
);

-- ============================================
-- Storage 파일 경로 구조
-- ============================================
-- 권장 구조: documents/{user_id}/{doc_id}/{filename}
-- 예시: documents/550e8400-e29b-41d4-a716-446655440000/abc123/계약서.pdf
--
-- 이 구조를 사용하면:
-- 1. 사용자별 폴더 격리 (RLS로 자동 보호)
-- 2. 문서별 파일 그룹화 (원본 + 처리된 파일)
-- 3. 파일명 충돌 방지
-- ============================================

-- ============================================
-- 검증 쿼리
-- ============================================
-- 버킷 설정 확인:
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets
-- WHERE id = 'documents';
--
-- Storage 정책 확인:
-- SELECT policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'storage'
-- AND tablename = 'objects';
-- ============================================

-- 8. 코멘트 추가
COMMENT ON POLICY "Users can upload to own folder" ON storage.objects IS
  '사용자는 자신의 user_id 폴더에만 파일을 업로드할 수 있습니다.';

COMMENT ON POLICY "Users can view own files" ON storage.objects IS
  '사용자는 자신의 폴더에 있는 파일만 조회할 수 있습니다.';

COMMENT ON POLICY "Admins can view all files" ON storage.objects IS
  '관리자는 모든 파일을 조회할 수 있습니다 (관리 및 지원 목적).';
