import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import GlobalModalManager from "@/components/modals/GlobalModalManager";

const inter = Inter({
  subsets: ["latin"],
  display: "swap", // 폰트 로딩 최적화
  preload: true,
});

// SEO 메타데이터 설정
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://zipcheck.kr'),

  title: {
    default: "집체크 | AI 부동산 계약 리스크 분석",
    template: "%s | 집체크",
  },

  description: "AI를 활용한 부동산 계약서 및 등기부등본 분석 서비스. 전세사기 예방, 계약 리스크 자동 점검, 전문가 수준의 부동산 분석을 3초 만에 확인하세요.",

  keywords: ["부동산 분석", "계약서 검토", "등기부등본", "전세사기 예방", "AI 분석", "부동산 리스크", "계약 리스크", "전월세 계약", "집체크"],

  authors: [{ name: "집체크" }],

  creator: "집체크",

  publisher: "집체크",

  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },

  // Open Graph 설정
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "집체크",
    title: "집체크 | AI 부동산 계약 리스크 분석",
    description: "AI를 활용한 부동산 계약서 및 등기부등본 분석 서비스. 전세사기 예방, 계약 리스크 자동 점검",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "집체크 - AI 부동산 분석 서비스",
      },
    ],
  },

  // Twitter Card 설정
  twitter: {
    card: "summary_large_image",
    title: "집체크 | AI 부동산 계약 리스크 분석",
    description: "AI를 활용한 부동산 계약서 및 등기부등본 분석 서비스",
    images: ["/og-image.jpg"],
    creator: "@zipcheck",
  },

  // 언어 설정 (국문 서비스)
  alternates: {
    canonical: "/",
    languages: {
      "ko-KR": "/",
    },
  },

  // 검색엔진 설정
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // 추가 메타 태그
  verification: {
    // Google Search Console 인증 코드 (나중에 추가)
    // google: "your-verification-code",
    // Naver Search Advisor 인증 코드 (나중에 추가)
    // other: {
    //   "naver-site-verification": "your-naver-verification-code",
    // },
  },

  // App Links
  other: {
    "theme-color": "#D32F2F",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* Favicon */}
        <link rel="icon" href="/logo.png" type="image/png" />
        {/* Cloudflare Turnstile */}
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
        />
      </head>
      <body className={inter.className}>
        {children}
        {/* Global modal portal mounted at root so store-driven modals can render */}
        <GlobalModalManager />
      </body>
    </html>
  );
}
