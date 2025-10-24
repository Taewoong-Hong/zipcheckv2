import { MetadataRoute } from 'next';

/**
 * Google/Naver에게 사이트 구조를 알려주는 sitemap.xml 자동 생성
 *
 * 접근: https://zipcheck.kr/sitemap.xml
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://zipcheck.kr';
  const now = new Date();

  return [
    // 메인 페이지 (최우선)
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },

    // 핵심 마케팅 페이지
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/company`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },

    // 가이드 페이지 (SEO 핵심 콘텐츠)
    {
      url: `${baseUrl}/guide/lease-analysis`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guide/purchase-review`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guide/fraud-prevention`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guide/rental-checklist`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },

    // 법적 문서 (필수 페이지)
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },

    // 로그인 페이지 (낮은 우선순위)
    {
      url: `${baseUrl}/login`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },

    // 주의: 인증/결제 페이지는 robots.txt에서 차단
    // /auth/*, /checkout/* 등은 포함하지 않음
  ];
}
