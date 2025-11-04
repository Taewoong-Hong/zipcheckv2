-- ============================================
-- artifacts 버킷 허용 MIME 타입 업데이트
-- ============================================
-- image/jpg 추가 (jpg 확장자 지원)
-- ============================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/jpg',    -- 추가: jpg 확장자 지원
  'image/png'
]
WHERE id = 'artifacts';

-- 검증: 업데이트된 MIME 타입 확인
SELECT id, name, allowed_mime_types
FROM storage.buckets
WHERE id = 'artifacts';
