/**
 * JSON-LD 구조화 데이터 컴포넌트
 *
 * Google이 페이지 내용을 더 정확하게 이해하도록 돕는 Schema.org 마크업
 *
 * 사용 예시:
 * ```tsx
 * <JsonLd data={softwareApplicationSchema} />
 * ```
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * SaaS 서비스용 구조화 데이터
 * 메인 페이지나 서비스 소개 페이지에 사용
 */
export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "집체크",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "6900",
    priceCurrency: "KRW",
    description: "월 6,900원 (크레딧 20개)",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "126",
  },
  description: "AI를 활용한 부동산 계약서 및 등기부등본 분석 서비스. 전세사기 예방, 계약 리스크 자동 점검",
  url: "https://zipcheck.kr",
  screenshot: "https://zipcheck.kr/og-image.jpg",
  featureList: [
    "등기부등본 자동 분석",
    "계약서 리스크 점검",
    "전세사기 예방 알림",
    "AI 부동산 상담",
  ],
};

/**
 * FAQ 페이지용 구조화 데이터 생성 함수
 *
 * @param faqs - 질문과 답변 배열
 * @returns Schema.org FAQPage 객체
 */
export function createFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

/**
 * 가이드/블로그 아티클용 구조화 데이터 생성 함수
 *
 * @param article - 아티클 정보
 * @returns Schema.org Article 객체
 */
export function createArticleSchema(article: {
  title: string;
  description: string;
  publishedDate: string;
  modifiedDate: string;
  authorName: string;
  imageUrl: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    image: article.imageUrl,
    datePublished: article.publishedDate,
    dateModified: article.modifiedDate,
    author: {
      "@type": "Organization",
      name: article.authorName,
    },
    publisher: {
      "@type": "Organization",
      name: "집체크",
      logo: {
        "@type": "ImageObject",
        url: "https://zipcheck.kr/logo.png",
      },
    },
  };
}

/**
 * HowTo (가이드/튜토리얼)용 구조화 데이터 생성 함수
 *
 * @param howTo - 가이드 정보
 * @returns Schema.org HowTo 객체
 */
export function createHowToSchema(howTo: {
  name: string;
  description: string;
  totalTime: string; // "PT10M" (10분)
  steps: { name: string; text: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: howTo.name,
    description: howTo.description,
    totalTime: howTo.totalTime,
    step: howTo.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

/**
 * 조직(회사) 정보용 구조화 데이터
 * About/Company 페이지에 사용
 */
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "집체크",
  url: "https://zipcheck.kr",
  logo: "https://zipcheck.kr/logo.png",
  description: "AI 기반 부동산 계약 리스크 분석 서비스",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "Customer Service",
    email: "support@zipcheck.kr",
  },
  sameAs: [
    // SNS 링크 (있다면 추가)
    // "https://www.facebook.com/zipcheck",
    // "https://twitter.com/zipcheck",
  ],
};

/**
 * 빵조각(Breadcrumb) 네비게이션용 구조화 데이터
 *
 * @param breadcrumbs - 빵조각 항목 배열
 * @returns Schema.org BreadcrumbList 객체
 */
export function createBreadcrumbSchema(
  breadcrumbs: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
