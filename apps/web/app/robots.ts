import { MetadataRoute } from 'next';

/**
 * 검색엔진 크롤러에게 어떤 페이지를 크롤링할지 알려주는 robots.txt 자동 생성
 *
 * 접근: https://zipcheck.kr/robots.txt
 *
 * 주요 규칙:
 * - 공개 페이지: 모두 허용 (/, /pricing, /guide/*, /faq 등)
 * - 비공개 페이지: 차단 (/auth/*, /checkout/*, /api/*)
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://zipcheck.kr';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',           // API 엔드포인트 차단
          '/auth/',          // 인증 페이지 차단 (OAuth 콜백 등)
          '/checkout/',      // 결제 페이지 차단
          '/auth/callback',  // OAuth 콜백 차단
          '/auth/password',  // 비밀번호 재설정 차단
        ],
      },
      // Google Bot 특화 규칙 (선택사항)
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/auth/', '/checkout/'],
      },
      // Naver Bot 특화 규칙 (선택사항)
      {
        userAgent: 'Yeti',
        allow: '/',
        disallow: ['/api/', '/auth/', '/checkout/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
