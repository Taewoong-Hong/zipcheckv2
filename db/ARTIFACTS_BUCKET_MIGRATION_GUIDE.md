# artifacts 버킷 마이그레이션 가이드

## 📋 개요

`artifacts` Supabase Storage 버킷을 생성하고 RLS 정책을 설정하는 마이그레이션입니다.

**목적**: 등기부 PDF 파일을 안전하게 저장하고 사용자별로 격리된 접근 제어 제공

---

## 🔧 마이그레이션 적용 방법

### 1️⃣ Supabase SQL Editor로 적용 (권장)

1. **Supabase Dashboard** 접속: https://supabase.com/dashboard
2. **SQL Editor** 메뉴 이동
3. 다음 파일 내용을 복사하여 실행:
   ```
   supabase/migrations/008_create_artifacts_bucket.sql
   ```

### 2️⃣ Supabase CLI로 적용

```bash
cd c:/dev/zipcheckv2
supabase db push
```

---

## ✅ 검증 방법

### 1. 버킷 생성 확인

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'artifacts';
```

**Expected Output**:
```
| id        | name      | public | file_size_limit | allowed_mime_types                              |
|-----------|-----------|--------|-----------------|------------------------------------------------|
| artifacts | artifacts | false  | 20971520        | {application/pdf,application/octet-stream}     |
```

### 2. RLS 정책 확인

```sql
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%artifacts%';
```

**Expected Policies**:
- `Users can upload to own folder in artifacts` (INSERT)
- `Users can view own files in artifacts` (SELECT)
- `Users can update own files in artifacts` (UPDATE)
- `Users can delete own files in artifacts` (DELETE)
- `Admins can view all files in artifacts` (SELECT)
- `Admins can delete all files in artifacts` (DELETE)

### 3. 실제 업로드 테스트

**프론트엔드에서 테스트**:
1. 로컬 개발 서버 실행:
   ```bash
   npm run dev
   ```
2. 로그인 후 채팅에서 등기부 업로드 테스트
3. 브라우저 개발자 도구 Network 탭에서 `/api/registry/upload` 응답 확인:
   ```json
   {
     "artifactId": "...",
     "filePath": "user_id/case_id/timestamp-filename.pdf"
   }
   ```

**Supabase Storage에서 확인**:
1. **Supabase Dashboard** → **Storage** 메뉴
2. `artifacts` 버킷 클릭
3. 업로드된 파일 확인: `{user_id}/{case_id}/...`

---

## 🚨 주의사항

### 1. 보안 정책
- ✅ **비공개 버킷**: `public = false`로 설정되어 있어, 직접 URL로는 접근 불가
- ✅ **RLS 자동 적용**: 사용자는 자신의 `user_id` 폴더에만 접근 가능
- ✅ **서명된 URL**: 백엔드에서 임시 서명된 URL 생성하여 AI 파서에 전달

### 2. 파일 경로 구조
```
artifacts/
├── {user_id}/
│   ├── {case_id_1}/
│   │   ├── 1738123456789-registry.pdf
│   │   └── 1738123457890-contract.pdf
│   └── {case_id_2}/
│       └── 1738123458901-registry.pdf
```

### 3. 파일 크기 제한
- **Max Size**: 20MB
- **Allowed MIME**: `application/pdf`, `application/octet-stream`

### 4. 기존 데이터 마이그레이션
만약 기존에 `documents` 버킷을 사용하고 있었다면:

```sql
-- documents → artifacts 파일 이동 (수동 확인 필요)
-- 1. documents 버킷의 파일 목록 확인
SELECT name, metadata FROM storage.objects WHERE bucket_id = 'documents';

-- 2. 필요 시 수동으로 파일 이동 (Supabase Dashboard UI 사용 권장)
```

---

## 📊 적용 후 확인 사항

### ✅ 체크리스트
- [ ] `artifacts` 버킷 생성 확인
- [ ] RLS 정책 6개 생성 확인
- [ ] 로컬 환경에서 PDF 업로드 테스트 성공
- [ ] `v2_artifacts` 테이블에 레코드 생성 확인
- [ ] Supabase Storage에서 파일 확인
- [ ] AI 파서가 서명된 URL로 파일 다운로드 성공

### 🐛 트러블슈팅

#### 1. 업로드 실패: "Failed to upload file"
**원인**: 버킷이 생성되지 않았거나 RLS 정책 누락
**해결**:
```sql
-- 버킷 존재 확인
SELECT * FROM storage.buckets WHERE id = 'artifacts';

-- 없으면 마이그레이션 재실행
-- supabase/migrations/008_create_artifacts_bucket.sql
```

#### 2. 업로드 실패: "Unauthorized"
**원인**: RLS 정책이 사용자 인증 토큰을 확인하지 못함
**해결**:
```typescript
// 프론트엔드에서 Authorization 헤더 확인
const token = session?.access_token;
console.log('Auth token:', token ? 'exists' : 'missing');
```

#### 3. 파일은 업로드되었지만 조회 불가
**원인**: SELECT 정책 누락
**해결**:
```sql
-- SELECT 정책 확인
SELECT * FROM pg_policies
WHERE tablename = 'objects'
  AND cmd = 'SELECT'
  AND policyname LIKE '%artifacts%';

-- 없으면 정책 재생성
CREATE POLICY "Users can view own files in artifacts" ...
```

---

## 🔗 관련 파일

- **마이그레이션**: `supabase/migrations/008_create_artifacts_bucket.sql`
- **업로드 API**: `apps/web/app/api/registry/upload/route.ts`
- **프론트엔드 호출**: `apps/web/lib/analysisFlow.ts:183`
- **채팅 인터페이스**: `apps/web/components/chat/ChatInterface.tsx:384`

---

## 📝 커밋 메시지 예시

```bash
git add supabase/migrations/008_create_artifacts_bucket.sql
git add db/ARTIFACTS_BUCKET_MIGRATION_GUIDE.md
git commit -m "feat: Add artifacts Storage bucket for registry PDFs

- Create artifacts bucket with 20MB limit
- Add RLS policies for user-specific folder access
- Support PDF upload workflow in chat interface
- Enable AI parser integration with signed URLs

Refs: #PDF-UPLOAD-FLOW"
```
