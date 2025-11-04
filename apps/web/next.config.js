/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: false,
  },

  // 이미지 최적화 설정 (Core Web Vitals 개선)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'], // 최신 이미지 포맷 우선 사용
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // 압축 활성화
  compress: true,

  // 트레일링 슬래시 제거 (SEO 중복 URL 방지)
  trailingSlash: false,

  // 리다이렉트 설정 (apex → www, API 제외)
  async redirects() {
    return [
      {
        source: '/:path((?!api).*)*', // API 경로 제외 (negative lookahead)
        has: [
          {
            type: 'host',
            value: 'zipcheck.kr',
          },
        ],
        destination: 'https://www.zipcheck.kr/:path*',
        permanent: true, // 308 영구 리다이렉트 (SEO)
      },
    ];
  },

  // 헤더 설정 (보안 및 성능)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
        ],
      },
      {
        // 정적 자산 캐싱 (이미지, 폰트 등)
        source: '/(.*)\\.(jpg|jpeg|png|gif|ico|svg|webp|avif|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig