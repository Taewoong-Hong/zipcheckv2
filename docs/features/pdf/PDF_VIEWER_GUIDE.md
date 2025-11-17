# 📄 집체크 PDF 뷰어 시스템 가이드

**작성일**: 2025-01-27
**버전**: 1.0.0
**기반 기술**: Mozilla PDF.js (react-pdf wrapper)

---

## 🎯 개요

집체크 서비스에서 등기부등본 및 계약서 PDF를 안전하게 열람할 수 있는 전용 뷰어 시스템입니다.

### 핵심 기능
- ✅ PDF 렌더링 (Canvas 기반)
- ✅ 페이지 네비게이션 (이전/다음, 페이지 점프)
- ✅ 확대/축소 (50% ~ 200%)
- ✅ 회전 (90도 단위)
- ✅ 전체화면 모드
- ✅ 다운로드 (권한 기반)
- ✅ 키보드 단축키 (Ctrl + ±)
- 🔜 주석 및 마킹 (개발 예정)
- 🔜 텍스트 검색 (개발 예정)
- 🔜 썸네일 미리보기 (개발 예정)

---

## 🏗️ 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│ User Browser                                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ /pdf/[documentId]                                       │ │
│  │  - 인증 확인                                            │ │
│  │  - 권한 검증                                            │ │
│  │  - 서명된 URL 생성                                      │ │
│  └──────────────┬───────────────────────────────────────┘ │
│                 │                                            │
│  ┌──────────────▼───────────────────────────────────────┐ │
│  │ PDFViewer Component                                   │ │
│  │  - react-pdf (PDF.js wrapper)                         │ │
│  │  - Canvas 렌더링                                      │ │
│  │  - 확대/축소/회전/페이지 이동                          │ │
│  └──────────────┬───────────────────────────────────────┘ │
│                 │                                            │
└─────────────────┼────────────────────────────────────────┘
                  │
        ┌─────────▼─────────────┐
        │ Supabase Storage      │
        │  - zipcheck-documents │
        │  - RLS 보안           │
        │  - 서명된 URL (1h)    │
        └───────────────────────┘
```

---

## 📦 설치된 패키지

### 프론트엔드
```json
{
  "dependencies": {
    "react-pdf": "^9.1.1",
    "pdfjs-dist": "^4.9.155"
  }
}
```

### PDF.js Worker 설정
```typescript
// components/pdf/PDFViewer.tsx
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
```

---

## 🔧 구현 파일

### 1️⃣ PDF 뷰어 컴포넌트
**파일**: [components/pdf/PDFViewer.tsx](components/pdf/PDFViewer.tsx)

**기능**:
- PDF 렌더링 (react-pdf + Canvas)
- 페이지 네비게이션
- 확대/축소 (0.5x ~ 2.0x)
- 회전 (0°, 90°, 180°, 270°)
- 전체화면 모드
- 다운로드 (권한 기반)
- 툴바 UI (상단)
- 정보바 UI (하단)

**사용 예시**:
```typescript
import PDFViewer from '@/components/pdf/PDFViewer';

<PDFViewer
  fileUrl="/api/pdf/view/doc_abc123"
  fileName="등기부등본.pdf"
  allowDownload={true}
  onClose={() => router.back()}
/>
```

### 2️⃣ PDF 뷰어 전용 페이지
**파일**: [app/pdf/[documentId]/page.tsx](app/pdf/[documentId]/page.tsx)

**기능**:
- 인증 확인 (Supabase Auth)
- 권한 검증 (RLS 자동 적용)
- 문서 메타데이터 조회
- 서명된 URL 생성 (1시간 유효)
- 암호화된 파일명 복호화
- 에러 핸들링

**접속 URL**:
```
https://zipcheck.kr/pdf/doc_abc123def456
```

### 3️⃣ PDF 프록시 API (로컬 파일용)
**파일**: [app/api/pdf/proxy/route.ts](app/api/pdf/proxy/route.ts)

**기능**:
- 로컬 파일 시스템의 PDF를 안전하게 제공
- 경로 탐색 공격 방지 (`..` 필터링)
- 인증 확인
- 캐싱 헤더 설정 (1시간)

**사용 예시**:
```typescript
const fileUrl = `/api/pdf/proxy?path=${encodeURIComponent('/tmp/doc.pdf')}`;
```

### 4️⃣ PDF 주석 컴포넌트 (개발 예정)
**파일**: [components/pdf/PDFAnnotation.tsx](components/pdf/PDFAnnotation.tsx)

**기능** (추후 구현):
- 텍스트 하이라이트
- 메모 추가
- 도형 그리기 (사각형, 원, 화살표)
- 주석 저장/불러오기 (Supabase)
- 협업 주석 (다른 사용자와 공유)

---

## 🔐 보안 설계

### 1️⃣ 인증 (Authentication)
```typescript
// 1. Supabase Auth 세션 확인
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  router.push('/'); // 로그인 페이지로 리다이렉트
  return;
}
```

### 2️⃣ 권한 (Authorization)
```typescript
// 2. 문서 소유자 확인
const { data: document } = await supabase
  .from('v2_documents')
  .select('user_id')
  .eq('id', documentId)
  .single();

if (document.user_id !== session.user.id) {
  // RLS가 자동으로 차단하지만 명시적 확인
  setError('접근 권한이 없습니다.');
  return;
}
```

### 3️⃣ 서명된 URL (Signed URL)
```typescript
// 3. 1시간 유효한 서명된 URL 생성
const { data: urlData } = await supabase.storage
  .from('zipcheck-documents')
  .createSignedUrl(filePath, 3600); // 1시간

setFileUrl(urlData.signedUrl);
```

### 4️⃣ RLS (Row Level Security)
```sql
-- Supabase Storage RLS 정책
-- 사용자는 본인 문서만 조회 가능
CREATE POLICY "Users can view own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'zipcheck-documents' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

---

## 💡 사용 시나리오

### 시나리오 1: 등기부등본 열람

**사용자 플로우**:
1. 사용자가 메인 페이지에서 "내 문서" 클릭
2. 문서 목록에서 등기부등본 선택
3. `/pdf/doc_abc123` 페이지로 이동
4. PDF 뷰어에서 문서 확인
5. 필요 시 다운로드 또는 주석 추가

**코드**:
```typescript
// 문서 목록 페이지
<button onClick={() => router.push(`/pdf/${doc.id}`)}>
  등기부등본 보기
</button>
```

### 시나리오 2: 관리자 문서 검토

**관리자 플로우**:
1. 관리자 페이지 (`/zc-ops-nx7k2`) 접속
2. 문서 데이터 탭에서 문서 선택
3. PDF 뷰어로 문서 확인
4. 주석 추가 (예: "검토 완료")
5. 승인 또는 반려 처리

**관리자 권한**:
```sql
-- 관리자는 모든 문서 조회 가능
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

## 🎨 UI/UX 가이드

### 툴바 (상단)
```
┌────────────────────────────────────────────────────────────┐
│ 📄 등기부등본.pdf          [<] 1 / 5 [>]   [-] 100% [+]   │
│                                            [↻] [⛶] [↓] [✕] │
└────────────────────────────────────────────────────────────┘
```

### 정보바 (하단)
```
┌────────────────────────────────────────────────────────────┐
│ 총 5페이지 · 배율 100% · 회전 0°      Ctrl + ± 확대/축소  │
└────────────────────────────────────────────────────────────┘
```

### 키보드 단축키
| 단축키 | 기능 |
|--------|------|
| `Ctrl + +` | 확대 |
| `Ctrl + -` | 축소 |
| `Ctrl + 0` | 원래 크기 (100%) |
| `←` | 이전 페이지 |
| `→` | 다음 페이지 |
| `Home` | 첫 페이지 |
| `End` | 마지막 페이지 |
| `F11` | 전체화면 토글 |
| `Esc` | 전체화면 해제 또는 닫기 |

---

## 🚀 배포 가이드

### 1️⃣ 환경변수 설정

#### Vercel (프론트엔드)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://gsiismzchtgdklvdvggu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Encryption
ENCRYPTION_KEY=your_encryption_key_here
```

### 2️⃣ Supabase Storage 설정

1. **Bucket 생성**: `zipcheck-documents` (비공개)
2. **RLS 정책 설정**: [SUPABASE_STORAGE_SETUP.md](SUPABASE_STORAGE_SETUP.md) 참고
3. **파일 업로드 테스트**

### 3️⃣ 배포 확인

```bash
# 1. 빌드
cd apps/web
npm run build

# 2. 로컬 테스트
npm run start

# 3. PDF 뷰어 접속
# http://localhost:3000/pdf/doc_abc123

# 4. Vercel 배포
vercel --prod
```

---

## 🧪 테스트 시나리오

### 테스트 1: 기본 렌더링
- [ ] PDF 파일이 정상적으로 로드됨
- [ ] 첫 페이지가 표시됨
- [ ] 툴바와 정보바가 표시됨

### 테스트 2: 페이지 네비게이션
- [ ] 다음 페이지 버튼 클릭 시 페이지 이동
- [ ] 이전 페이지 버튼 클릭 시 페이지 이동
- [ ] 페이지 입력창에 숫자 입력 시 해당 페이지로 이동
- [ ] 첫 페이지/마지막 페이지에서 버튼 비활성화

### 테스트 3: 확대/축소
- [ ] 확대 버튼 클릭 시 10% 확대
- [ ] 축소 버튼 클릭 시 10% 축소
- [ ] 최소 50%, 최대 200% 제한
- [ ] `Ctrl + +`, `Ctrl + -` 단축키 동작

### 테스트 4: 회전
- [ ] 회전 버튼 클릭 시 90도 회전
- [ ] 0° → 90° → 180° → 270° → 0° 순환

### 테스트 5: 전체화면
- [ ] 전체화면 버튼 클릭 시 전체화면 모드
- [ ] `Esc` 키로 전체화면 해제
- [ ] 툴바가 전체화면에서도 표시

### 테스트 6: 다운로드
- [ ] 다운로드 버튼 클릭 시 파일 다운로드
- [ ] 파일명이 올바르게 설정됨
- [ ] `allowDownload=false`일 때 버튼 숨김

### 테스트 7: 보안
- [ ] 비로그인 사용자 접근 차단
- [ ] 다른 사용자의 문서 접근 차단
- [ ] 서명된 URL 1시간 후 만료
- [ ] RLS 정책 적용 확인

---

## 🚨 트러블슈팅

### 문제 1: "PDF를 불러올 수 없습니다"

**원인**:
1. 파일 경로가 잘못됨
2. 서명된 URL이 만료됨
3. 파일이 손상됨

**해결**:
1. 파일 경로 확인 (`v2_documents.file_path`)
2. 서명된 URL 재생성 (새로고침)
3. PDF 파일 재업로드

### 문제 2: "Worker failed to load"

**원인**: PDF.js worker 경로 문제

**해결**:
```typescript
// PDFViewer.tsx
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
```

### 문제 3: 렌더링이 느림

**원인**: PDF 파일 크기가 큼

**해결**:
1. 파일 크기 압축 (Ghostscript)
2. 페이지별 로딩 (지연 로딩)
3. 썸네일 미리 생성

### 문제 4: 모바일에서 깨짐

**원인**: 반응형 CSS 문제

**해결**:
```typescript
// PDFViewer.tsx
<Page
  pageNumber={pageNumber}
  scale={scale}
  width={window.innerWidth - 32} // 좌우 패딩 16px * 2
/>
```

---

## 📊 성능 최적화

### 1️⃣ 지연 로딩
```typescript
// 현재 페이지만 렌더링
<Page pageNumber={pageNumber} />

// 추후: 인접 페이지 미리 로드
<Page pageNumber={pageNumber - 1} />
<Page pageNumber={pageNumber} />
<Page pageNumber={pageNumber + 1} />
```

### 2️⃣ 캐싱
```typescript
// 서명된 URL 캐싱 (로컬 스토리지)
const cachedUrl = localStorage.getItem(`pdf_${documentId}`);
if (cachedUrl && !isExpired(cachedUrl)) {
  setFileUrl(cachedUrl);
} else {
  // 새 URL 생성
}
```

### 3️⃣ 압축
```bash
# Ghostscript로 PDF 압축
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 \
   -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH \
   -sOutputFile=compressed.pdf input.pdf
```

---

## 📚 추가 기능 로드맵

### Phase 1: 핵심 기능 ✅
- [x] PDF 렌더링
- [x] 페이지 네비게이션
- [x] 확대/축소/회전
- [x] 다운로드
- [x] 전체화면

### Phase 2: 사용성 개선 🔜
- [ ] 텍스트 검색 (PDF.js search API)
- [ ] 썸네일 사이드바
- [ ] 북마크 기능
- [ ] 인쇄 기능

### Phase 3: 협업 기능 🔜
- [ ] 주석 및 마킹 (pdf-annotate.js)
- [ ] 협업 주석 (실시간 공유)
- [ ] 댓글 기능
- [ ] 버전 관리

### Phase 4: AI 통합 🔮
- [ ] OCR (이미지 PDF → 텍스트)
- [ ] AI 요약 (ChatGPT)
- [ ] 리스크 자동 하이라이트
- [ ] 번역 (한/영)

---

## 📖 참고 자료

### 공식 문서
- [Mozilla PDF.js](https://mozilla.github.io/pdf.js/)
- [react-pdf](https://github.com/wojtekmaj/react-pdf)
- [Supabase Storage](https://supabase.com/docs/guides/storage)

### 관련 파일
- [PDFViewer 컴포넌트](components/pdf/PDFViewer.tsx)
- [PDF 뷰어 페이지](app/pdf/[documentId]/page.tsx)
- [PDF 프록시 API](app/api/pdf/proxy/route.ts)
- [Supabase Storage 설정](SUPABASE_STORAGE_SETUP.md)

---

**마지막 업데이트**: 2025-01-27
