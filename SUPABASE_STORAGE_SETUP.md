# 📦 Supabase Storage 설정 가이드

**작성일**: 2025-01-27
**목적**: PDF 파일을 Supabase Storage에 안전하게 저장하고 관리

---

## 🎯 Storage 구조

```
zipcheck-documents/
├── documents/
│   ├── {user_id}/
│   │   ├── registry/           # 등기부등본
│   │   │   ├── {doc_id}.pdf
│   │   │   └── ...
│   │   └── contract/           # 계약서
│   │       ├── {doc_id}.pdf
│   │       └── ...
└── thumbnails/                 # 썸네일 (추후)
    └── {doc_id}.jpg
```

---

## 🔧 Supabase Dashboard 설정

### 1️⃣ Storage Bucket 생성

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택: `gsiismzchtgdklvdvggu`

2. **Storage → Buckets 이동**

3. **새 Bucket 생성**
   - **Name**: `zipcheck-documents`
   - **Public**: ❌ (비공개)
   - **File size limit**: `50 MB`
   - **Allowed MIME types**: `application/pdf`

### 2️⃣ RLS (Row Level Security) 정책 설정

#### Policy 1: 사용자는 본인 문서만 업로드 가능
```sql
CREATE POLICY "Users can upload own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'zipcheck-documents' AND
  (storage.foldername(name))[1] = 'documents' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

#### Policy 2: 사용자는 본인 문서만 조회 가능
```sql
CREATE POLICY "Users can view own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'zipcheck-documents' AND
  (storage.foldername(name))[1] = 'documents' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

#### Policy 3: 사용자는 본인 문서만 삭제 가능
```sql
CREATE POLICY "Users can delete own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'zipcheck-documents' AND
  (storage.foldername(name))[1] = 'documents' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

#### Policy 4: 관리자는 모든 문서 조회 가능
```sql
CREATE POLICY "Admins can view all documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'zipcheck-documents' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);
```

---

## 💻 코드 구현

### 프론트엔드 (Next.js)

#### 파일 업로드
```typescript
import { supabase } from '@/lib/supabase';

async function uploadPDF(file: File, documentId: string, userId: string) {
  const filePath = `documents/${userId}/registry/${documentId}.pdf`;

  const { data, error } = await supabase.storage
    .from('zipcheck-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Upload error:', error);
    throw error;
  }

  return data.path;
}
```

#### 서명된 URL 생성 (1시간 유효)
```typescript
async function getSignedUrl(filePath: string) {
  const { data, error } = await supabase.storage
    .from('zipcheck-documents')
    .createSignedUrl(filePath, 3600); // 1시간

  if (error) {
    console.error('Signed URL error:', error);
    throw error;
  }

  return data.signedUrl;
}
```

#### 파일 삭제
```typescript
async function deletePDF(filePath: string) {
  const { error } = await supabase.storage
    .from('zipcheck-documents')
    .remove([filePath]);

  if (error) {
    console.error('Delete error:', error);
    throw error;
  }
}
```

### 백엔드 (Python FastAPI)

#### 파일 업로드
```python
from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def upload_pdf(file_path: str, user_id: str, doc_id: str):
    """PDF 파일을 Supabase Storage에 업로드"""
    storage_path = f"documents/{user_id}/registry/{doc_id}.pdf"

    with open(file_path, 'rb') as f:
        response = supabase.storage.from_('zipcheck-documents').upload(
            path=storage_path,
            file=f,
            file_options={"content-type": "application/pdf"}
        )

    return storage_path
```

#### 서명된 URL 생성
```python
def get_signed_url(storage_path: str) -> str:
    """서명된 URL 생성 (1시간 유효)"""
    response = supabase.storage.from_('zipcheck-documents').create_signed_url(
        path=storage_path,
        expires_in=3600  # 1시간
    )

    return response['signedURL']
```

---

## 🔄 마이그레이션: 로컬 파일 → Supabase Storage

### 마이그레이션 스크립트
```python
#!/usr/bin/env python3
"""
로컬 PDF 파일을 Supabase Storage로 마이그레이션
"""

import os
from supabase import create_client
from sqlalchemy import create_engine, text

# 환경변수
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
engine = create_engine(DATABASE_URL)

def migrate_local_files():
    """로컬 파일을 Supabase Storage로 이동"""
    with engine.connect() as conn:
        # 로컬 파일 경로를 가진 문서 조회
        result = conn.execute(text("""
            SELECT id, user_id, file_path, file_name, document_type
            FROM v2_documents
            WHERE file_path IS NOT NULL
              AND file_path LIKE '/tmp/%'
        """))

        for row in result:
            doc_id, user_id, file_path, file_name, doc_type = row

            # 파일 존재 확인
            if not os.path.exists(file_path):
                print(f"⏭️  파일 없음: {file_path}")
                continue

            # Supabase Storage 경로
            storage_path = f"documents/{user_id}/{doc_type}/{doc_id}.pdf"

            try:
                # 업로드
                with open(file_path, 'rb') as f:
                    supabase.storage.from_('zipcheck-documents').upload(
                        path=storage_path,
                        file=f,
                        file_options={"content-type": "application/pdf"}
                    )

                # DB 경로 업데이트
                conn.execute(text("""
                    UPDATE v2_documents
                    SET file_path = :storage_path
                    WHERE id = :doc_id
                """), {"storage_path": storage_path, "doc_id": doc_id})

                print(f"✅ 업로드 완료: {storage_path}")

                # 로컬 파일 삭제 (선택사항)
                # os.remove(file_path)

            except Exception as e:
                print(f"❌ 업로드 실패 ({doc_id}): {e}")

if __name__ == "__main__":
    migrate_local_files()
```

---

## 📊 용량 관리

### Storage 사용량 확인
```sql
-- Supabase SQL Editor에서 실행
SELECT
  bucket_id,
  COUNT(*) as file_count,
  pg_size_pretty(SUM(metadata->>'size')::bigint) as total_size
FROM storage.objects
WHERE bucket_id = 'zipcheck-documents'
GROUP BY bucket_id;
```

### 오래된 파일 정리 (90일 이상)
```sql
-- 90일 이상 된 파일 조회
SELECT
  name,
  created_at,
  pg_size_pretty((metadata->>'size')::bigint) as size
FROM storage.objects
WHERE bucket_id = 'zipcheck-documents'
  AND created_at < NOW() - INTERVAL '90 days'
ORDER BY created_at;
```

### 삭제
```typescript
// 프론트엔드에서 삭제
const { error } = await supabase.storage
  .from('zipcheck-documents')
  .remove([filePath]);
```

---

## 🚨 트러블슈팅

### 문제 1: "new row violates row-level security policy"

**원인**: RLS 정책이 설정되지 않았거나 잘못됨

**해결**:
1. Supabase Dashboard → Storage → Policies 확인
2. 위의 RLS 정책 SQL 실행
3. `auth.uid()`가 올바른지 확인

### 문제 2: "Bucket not found"

**원인**: Bucket이 생성되지 않음

**해결**:
1. Supabase Dashboard → Storage → Buckets
2. `zipcheck-documents` 버킷 생성

### 문제 3: "File size exceeds limit"

**원인**: 파일 크기가 제한을 초과

**해결**:
1. Bucket 설정에서 `File size limit` 증가
2. 또는 압축하여 업로드

---

## 📚 참고 자료

- [Supabase Storage 문서](https://supabase.com/docs/guides/storage)
- [RLS 가이드](https://supabase.com/docs/guides/auth/row-level-security)
- [Signed URLs](https://supabase.com/docs/guides/storage/uploads/signed-urls)

---

**마지막 업데이트**: 2025-01-27
