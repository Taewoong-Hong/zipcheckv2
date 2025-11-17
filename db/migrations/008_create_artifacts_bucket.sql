-- ============================================
-- Migration: Create artifacts Storage Bucket
-- Date: 2025-02-04
-- Description: artifacts 버킷 생성 및 RLS 정책 설정
-- ============================================

-- 1. artifacts 버킷 생성 (등기부 PDF 저장용)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artifacts',
  'artifacts',
  false,  -- 비공개 버킷 (인증된 사용자만 접근)
  20971520,  -- 20MB 제한
  ARRAY['application/pdf', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/pdf', 'application/octet-stream'];

-- 2. Storage 정책: 사용자는 자신의 폴더에만 업로드 가능
DROP POLICY IF EXISTS "Users can upload to own folder in artifacts" ON storage.objects;
CREATE POLICY "Users can upload to own folder in artifacts"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'artifacts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
);

-- 3. Storage 정책: 사용자는 자신의 파일만 조회 가능
DROP POLICY IF EXISTS "Users can view own files in artifacts" ON storage.objects;
CREATE POLICY "Users can view own files in artifacts"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'artifacts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
);

-- 4. Storage 정책: 사용자는 자신의 파일만 업데이트 가능
DROP POLICY IF EXISTS "Users can update own files in artifacts" ON storage.objects;
CREATE POLICY "Users can update own files in artifacts"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'artifacts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'artifacts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
);

-- 5. Storage 정책: 사용자는 자신의 파일만 삭제 가능
DROP POLICY IF EXISTS "Users can delete own files in artifacts" ON storage.objects;
CREATE POLICY "Users can delete own files in artifacts"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'artifacts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.role() = 'authenticated'
);

-- 6. 관리자 정책: 관리자는 모든 파일 조회 가능
DROP POLICY IF EXISTS "Admins can view all files in artifacts" ON storage.objects;
CREATE POLICY "Admins can view all files in artifacts"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'artifacts'
  AND (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
);

-- 7. 관리자 정책: 관리자는 모든 파일 삭제 가능
DROP POLICY IF EXISTS "Admins can delete all files in artifacts" ON storage.objects;
CREATE POLICY "Admins can delete all files in artifacts"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'artifacts'
  AND (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
);

-- ============================================
-- Storage 파일 경로 구조
-- ============================================
-- 구조: artifacts/{user_id}/{case_id}/{timestamp}-{filename}
-- 예시: artifacts/550e8400.../abc123/1738123456789-registry.pdf
--
-- 이 구조를 사용하면:
-- 1. 사용자별 폴더 격리 (RLS로 자동 보호)
-- 2. 케이스별 파일 그룹화
-- 3. 타임스탬프로 파일명 충돌 방지
-- ============================================

-- 8. 코멘트 추가
COMMENT ON POLICY "Users can upload to own folder in artifacts" ON storage.objects IS
  '사용자는 자신의 user_id 폴더에만 파일을 업로드할 수 있습니다 (artifacts).';

COMMENT ON POLICY "Users can view own files in artifacts" ON storage.objects IS
  '사용자는 자신의 폴더에 있는 파일만 조회할 수 있습니다 (artifacts).';

COMMENT ON POLICY "Admins can view all files in artifacts" ON storage.objects IS
  '관리자는 모든 파일을 조회할 수 있습니다 (관리 및 지원 목적, artifacts).';
