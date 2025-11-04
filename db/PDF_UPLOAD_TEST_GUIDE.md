# PDF 업로드 기능 테스트 가이드

## ✅ 검증 완료 사항

### 1. Supabase Storage 버킷 (`artifacts`)
```
✅ 버킷 존재: artifacts (Private, 50MB 제한)
✅ RLS 정책: 4개 (INSERT, SELECT, UPDATE, DELETE)
✅ 허용된 MIME: application/pdf, image/jpeg, image/png
```

---

## 📋 PDF 업로드 플로우

### 1️⃣ **프론트엔드** (`ChatInterface.tsx`)
```typescript
// Line 384
await uploadRegistry(analysisContext.caseId, file);
```

### 2️⃣ **API 호출** (`analysisFlow.ts`)
```typescript
export async function uploadRegistry(caseId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('caseId', caseId);

  const response = await fetch('/api/registry/upload', {
    method: 'POST',
    body: formData,
    headers: { 'Authorization': `Bearer ${token}` },
  });
}
```

### 3️⃣ **백엔드 처리** (`/api/registry/upload/route.ts`)
```typescript
// 1. 인증 확인
const { data: { user } } = await supabase.auth.getUser();

// 2. 파일 검증
- Size: < 10MB
- MIME: application/pdf or application/octet-stream

// 3. Supabase Storage 업로드
const fileName = `${user.id}/${caseId}/${Date.now()}-${sanitizedName}`;
await supabase.storage.from('artifacts').upload(fileName, file);

// 4. v2_artifacts 테이블에 레코드 생성
await supabase.from('v2_artifacts').insert({ ... });

// 5. v2_cases 상태 업데이트: 'registry'
await supabase.from('v2_cases').update({ current_state: 'registry' });

// 6. AI 파서에 서명된 URL 전달
const { signedUrl } = await supabase.storage.from('artifacts').createSignedUrl(path, 600);
await fetch(`${AI_API_URL}/parse/registry`, { body: { file_url: signedUrl } });
```

---

## 🧪 테스트 시나리오

### ✅ **테스트 1: 정상 업로드**

**Steps**:
1. 로컬 개발 서버 실행:
   ```bash
   cd apps/web
   npm run dev
   ```

2. 브라우저에서 http://localhost:3000 접속

3. 로그인

4. 채팅 플로우 진행:
   - 주소 입력 → 계약 유형 선택 → 가격 입력
   - 등기부 업로드 선택 → PDF 파일 업로드

5. **예상 결과**:
   - ✅ "등기부등본을 확인하고 있습니다..." 메시지 표시
   - ✅ 백엔드 로그: `Uploading to artifacts: user_id/case_id/timestamp-filename.pdf`
   - ✅ 분석 시작

### ✅ **테스트 2: Supabase Storage 확인**

**Steps**:
1. Supabase Dashboard 접속: https://supabase.com/dashboard
2. **Storage** 메뉴 클릭
3. `artifacts` 버킷 선택
4. 업로드된 파일 확인:
   ```
   artifacts/
   └── {user_id}/
       └── {case_id}/
           └── 1738123456789-registry.pdf
   ```

### ✅ **테스트 3: v2_artifacts 테이블 확인**

**SQL**:
```sql
SELECT *
FROM v2_artifacts
WHERE artifact_type = 'registry_pdf'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Output**:
```
| id | case_id | user_id | artifact_type | file_path                | file_name      | file_size |
|----|---------|---------|---------------|--------------------------|----------------|-----------|
| 1  | abc123  | user1   | registry_pdf  | user1/abc123/1738...pdf | registry.pdf   | 1234567   |
```

### ✅ **테스트 4: v2_cases 상태 전환 확인**

**SQL**:
```sql
SELECT id, current_state, updated_at
FROM v2_cases
WHERE id = '{case_id}';
```

**Expected Output**:
```
current_state: 'registry'
```

---

## 🔧 디버깅 팁

### 1. **업로드 실패: 401 Unauthorized**
```javascript
// 브라우저 콘솔
console.log('Session:', session);
console.log('Access Token:', session?.access_token);

// 문제: 토큰이 없거나 만료됨
// 해결: 로그아웃 후 재로그인
```

### 2. **업로드 실패: 413 Payload Too Large**
```typescript
// 파일 크기 확인
console.log('File size:', file.size / 1024 / 1024, 'MB');

// 문제: 파일이 10MB 초과
// 해결: 파일 크기 제한 늘리기 (route.ts에서 수정)
```

### 3. **업로드 실패: RLS 정책 위반**
```sql
-- RLS 정책 확인
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%artifacts%';

-- 문제: INSERT 정책 누락
-- 해결: artifacts_upload_own 정책 재생성
```

### 4. **AI 파서 호출 실패**
```bash
# 백엔드 로그 확인
cd services/ai
python -m uvicorn app:app --reload --log-level debug

# /parse/registry 엔드포인트 확인
curl -X POST http://localhost:8000/parse/registry \
  -H "Content-Type: application/json" \
  -d '{"file_url": "https://..."}'
```

---

## 📊 성능 체크리스트

### ✅ 업로드 속도
- [ ] 1MB PDF: < 2초
- [ ] 5MB PDF: < 5초
- [ ] 10MB PDF: < 10초

### ✅ 저장소 확인
- [ ] Supabase Storage에 파일 존재
- [ ] v2_artifacts 테이블에 레코드 존재
- [ ] v2_cases.current_state = 'registry'

### ✅ 보안 검증
- [ ] 다른 사용자의 파일 조회 불가 (403 Forbidden)
- [ ] 비인증 사용자 업로드 불가 (401 Unauthorized)
- [ ] 파일명 한글/특수문자 sanitize 완료

---

## 🔗 관련 파일

- **프론트엔드**:
  - `apps/web/components/chat/ChatInterface.tsx:384`
  - `apps/web/lib/analysisFlow.ts:183`

- **백엔드**:
  - `apps/web/app/api/registry/upload/route.ts`

- **데이터베이스**:
  - `v2_artifacts` 테이블
  - `v2_cases` 테이블
  - `storage.objects` 테이블

---

## 🚨 주의사항

1. **파일명 한글 처리**:
   ```typescript
   // 한글 제거 및 특수문자 언더스코어 치환
   const sanitizedName = file.name
     .replace(/[^\x00-\x7F]/g, '')
     .replace(/[^a-zA-Z0-9._-]/g, '_');
   ```

2. **서명된 URL 만료 시간**: 600초 (10분)
   - AI 파서는 10분 내에 파일 다운로드 완료 필요

3. **RLS 정책**:
   - 사용자는 자신의 `user_id` 폴더에만 접근 가능
   - 관리자는 모든 파일 조회 가능 (admin 권한 필요)

---

## ✅ 최종 확인

```bash
# 1. 버킷 존재 확인
python db/check_artifacts_bucket.py

# 2. 로컬 서버 실행
cd apps/web && npm run dev

# 3. PDF 업로드 테스트 (UI)
# http://localhost:3000 → 로그인 → 채팅 → 업로드

# 4. Supabase Storage 확인
# Dashboard → Storage → artifacts
```
