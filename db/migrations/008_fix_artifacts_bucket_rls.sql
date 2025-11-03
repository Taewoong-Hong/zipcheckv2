-- Migration: Fix artifacts bucket RLS policies
-- Date: 2025-11-03
-- Purpose: Enable user upload to artifacts bucket with proper RLS

-- 1. Configure artifacts bucket (Private, 50MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('artifacts','artifacts', false, 52428800, ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO UPDATE SET
    public=false,
    file_size_limit=52428800,
    allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png'];

-- 2. Drop existing policies if any
DROP POLICY IF EXISTS artifacts_upload_own ON storage.objects;
DROP POLICY IF EXISTS artifacts_read_own ON storage.objects;
DROP POLICY IF EXISTS artifacts_update_own ON storage.objects;
DROP POLICY IF EXISTS artifacts_delete_own ON storage.objects;

-- 3. Create RLS policies (user can only access own folder)

-- INSERT: User can upload to their own folder
CREATE POLICY artifacts_upload_own ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id='artifacts'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND auth.role()='authenticated'
);

-- SELECT: User can read from their own folder
CREATE POLICY artifacts_read_own ON storage.objects
FOR SELECT USING (
    bucket_id='artifacts'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND auth.role()='authenticated'
);

-- UPDATE: User can update their own files
CREATE POLICY artifacts_update_own ON storage.objects
FOR UPDATE USING (
    bucket_id='artifacts'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND auth.role()='authenticated'
)
WITH CHECK (
    bucket_id='artifacts'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND auth.role()='authenticated'
);

-- DELETE: User can delete their own files
CREATE POLICY artifacts_delete_own ON storage.objects
FOR DELETE USING (
    bucket_id='artifacts'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND auth.role()='authenticated'
);
