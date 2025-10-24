# 🚀 집체크(ZipCheck) SEO 최적화 가이드

## 📋 적용 완료 항목

### 1️⃣ 루트 레이아웃 메타데이터 강화 ✅
**파일**: [apps/web/app/layout.tsx](../apps/web/app/layout.tsx)

**적용 내용**:
- ✅ `metadataBase` 설정 (sitemap, OG에 사용)
- ✅ 동적 title template (`%s | 집체크`)
- ✅ Open Graph 전체 설정
- ✅ Twitter Card 설정
- ✅ robots 설정 (index, follow)
- ✅ canonical URL 설정
- ✅ 언어 설정 (ko-KR)
- ✅ 폰트 최적화 (display: swap)

**주의사항**:
- `NEXT_PUBLIC_BASE_URL` 환경변수를 `.env.local`에 설정하세요
- OG 이미지(`/og-image.jpg`)를 `public/` 폴더에 추가하세요 (1200x630 권장)

---

### 2️⃣ sitemap.xml 자동 생성 ✅
**파일**: [apps/web/app/sitemap.ts](../apps/web/app/sitemap.ts)

**접근**: https://zipcheck.kr/sitemap.xml

**포함 페이지**:
- 메인 페이지 (priority: 1.0)
- 마케팅 페이지 (pricing, faq, company)
- 가이드 페이지 (4개)
- 법적 문서 (terms, privacy)

**제외 페이지**:
- 인증 페이지 (/auth/*)
- 결제 페이지 (/checkout/*)
- API 엔드포인트 (/api/*)

---

### 3️⃣ robots.txt 자동 생성 ✅
**파일**: [apps/web/app/robots.ts](../apps/web/app/robots.ts)

**접근**: https://zipcheck.kr/robots.txt

**크롤링 규칙**:
- ✅ 모든 공개 페이지 허용
- ❌ /api/, /auth/, /checkout/ 차단
- Google Bot, Naver Bot 특화 규칙

---

### 4️⃣ JSON-LD 구조화 데이터 ✅
**파일**: [apps/web/components/seo/JsonLd.tsx](../apps/web/components/seo/JsonLd.tsx)

**제공 스키마**:
- `SoftwareApplication`: SaaS 서비스 (메인 페이지)
- `FAQPage`: FAQ 페이지 (자동 적용됨)
- `Article`: 가이드/블로그 페이지
- `HowTo`: 튜토리얼 페이지
- `Organization`: 회사 소개 페이지
- `BreadcrumbList`: 빵조각 네비게이션

**사용 예시**:
```tsx
import { JsonLd, softwareApplicationSchema } from '@/components/seo/JsonLd';

export default function Page() {
  return (
    <>
      <JsonLd data={softwareApplicationSchema} />
      {/* 페이지 내용 */}
    </>
  );
}
```

---

### 5️⃣ 페이지별 메타데이터 ✅

**추가된 layout.tsx 파일들**:
- ✅ [apps/web/app/faq/layout.tsx](../apps/web/app/faq/layout.tsx)
- ✅ [apps/web/app/pricing/layout.tsx](../apps/web/app/pricing/layout.tsx)
- ✅ [apps/web/app/guide/layout.tsx](../apps/web/app/guide/layout.tsx)
- ✅ [apps/web/app/guide/lease-analysis/layout.tsx](../apps/web/app/guide/lease-analysis/layout.tsx)
- ✅ [apps/web/app/guide/purchase-review/layout.tsx](../apps/web/app/guide/purchase-review/layout.tsx)
- ✅ [apps/web/app/guide/fraud-prevention/layout.tsx](../apps/web/app/guide/fraud-prevention/layout.tsx)
- ✅ [apps/web/app/guide/rental-checklist/layout.tsx](../apps/web/app/guide/rental-checklist/layout.tsx)

각 페이지별로:
- ✅ 고유한 title
- ✅ 최적화된 description
- ✅ 관련 keywords
- ✅ Open Graph 설정
- ✅ canonical URL

---

### 6️⃣ Next.js 성능 최적화 ✅
**파일**: [apps/web/next.config.js](../apps/web/next.config.js)

**적용 내용**:
- ✅ 이미지 최적화 (AVIF, WebP 우선)
- ✅ SWC Minify 활성화
- ✅ 압축 활성화
- ✅ 트레일링 슬래시 제거 (중복 URL 방지)
- ✅ 보안 헤더 추가
- ✅ 정적 자산 캐싱 (1년)

---

## 🔧 환경 설정

### 1. 환경변수 설정

**`.env.local` 파일 생성** (apps/web/ 폴더):

```bash
# 프로덕션 URL
NEXT_PUBLIC_BASE_URL=https://zipcheck.kr

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. OG 이미지 추가

`apps/web/public/og-image.jpg` 파일을 생성하세요:
- **크기**: 1200x630px
- **형식**: JPG 또는 PNG
- **내용**: 집체크 로고 + 핵심 메시지

---

## 📊 Google Search Console 연동

### 1. 소유권 인증

**방법 1: HTML 태그 (권장)**
1. Google Search Console → 속성 추가
2. 메타 태그 인증 코드 복사
3. `apps/web/app/layout.tsx`의 `verification` 섹션 주석 해제:

```typescript
verification: {
  google: "your-verification-code", // 여기에 코드 붙여넣기
},
```

**방법 2: DNS TXT 레코드**
- 도메인 DNS 설정에서 TXT 레코드 추가

### 2. Sitemap 제출

1. Google Search Console → Sitemaps
2. `https://zipcheck.kr/sitemap.xml` 제출

---

## 🔍 Naver Search Advisor 연동 (선택)

### 1. 소유권 인증

1. Naver Search Advisor → 사이트 등록
2. 메타 태그 인증 코드 복사
3. `apps/web/app/layout.tsx`의 `verification` 섹션 주석 해제:

```typescript
verification: {
  other: {
    "naver-site-verification": "your-naver-verification-code",
  },
},
```

### 2. Sitemap 제출

1. Naver Search Advisor → 사이트 최적화 → 사이트맵 제출
2. `https://zipcheck.kr/sitemap.xml` 제출

---

## ✅ 배포 전 체크리스트

### 필수 작업
- [ ] `.env.local` 파일에 `NEXT_PUBLIC_BASE_URL` 설정
- [ ] `public/og-image.jpg` 파일 추가 (1200x630)
- [ ] Google Search Console 인증
- [ ] Sitemap 제출 (Google, Naver)
- [ ] 빌드 테스트: `npm run build`
- [ ] 로컬 테스트: `npm run start`

### 확인 사항
- [ ] https://zipcheck.kr/sitemap.xml 접근 확인
- [ ] https://zipcheck.kr/robots.txt 접근 확인
- [ ] 메인 페이지 view-source에서 메타 태그 확인
- [ ] Open Graph 미리보기 테스트: https://www.opengraph.xyz/
- [ ] Twitter Card 테스트: https://cards-dev.twitter.com/validator
- [ ] 모바일 친화성 테스트: https://search.google.com/test/mobile-friendly

### 성능 테스트
- [ ] Google Lighthouse 점수 확인 (목표: 90+)
  - Performance
  - Accessibility
  - Best Practices
  - SEO
- [ ] Core Web Vitals 확인
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1

---

## 🎯 추가 SEO 개선 제안

### 단기 (1-2주)
1. **회사 소개 페이지 추가**
   - Organization 구조화 데이터 적용
   - E-E-A-T 강화 (저자, 경력, 연락처)

2. **블로그/뉴스 섹션 추가**
   - Article 구조화 데이터 적용
   - 부동산 관련 키워드 타겟팅

3. **리뷰/후기 페이지**
   - Review, AggregateRating 구조화 데이터

### 중기 (1-2개월)
1. **로컬 SEO 강화**
   - 지역별 페이지 (서울, 경기, 부산 등)
   - LocalBusiness 구조화 데이터

2. **내부 링크 최적화**
   - 관련 가이드 간 링크
   - 빵조각 네비게이션

3. **동영상 콘텐츠**
   - 사용 방법 튜토리얼
   - VideoObject 구조화 데이터

### 장기 (3개월+)
1. **다국어 지원 (영어)**
   - hreflang 태그 확장
   - 영문 콘텐츠 제작

2. **AMP (선택)**
   - 모바일 로딩 속도 극대화

3. **PWA (Progressive Web App)**
   - 오프라인 지원
   - 앱 설치 가능

---

## 📞 문의 및 지원

SEO 관련 문의사항:
- 이메일: support@zipcheck.kr
- GitHub Issues: https://github.com/Taewoong-Hong/zipcheckv2/issues

---

**마지막 업데이트**: 2025-01-24
**담당자**: SEO 설계팀
