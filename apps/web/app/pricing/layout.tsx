import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '플랜 및 가격',
  description: '집체크 서비스 요금제를 확인하세요. Personal Plan (월 7,900원)과 Pro Plan (월 19,900원)으로 등기부 분석, AI 계약서 검토, 리스크 알림 기능을 이용하실 수 있습니다.',

  keywords: ['집체크 가격', '부동산 분석 요금', '등기부 분석 요금', '구독 플랜', 'AI 분석 가격'],

  openGraph: {
    title: '플랜 및 가격 | 집체크',
    description: '집체크 서비스 요금제를 확인하세요. Personal Plan과 Pro Plan 중 선택하세요.',
    type: 'website',
    url: '/pricing',
  },

  twitter: {
    title: '플랜 및 가격 | 집체크',
    description: '집체크 서비스 요금제를 확인하세요. Personal Plan과 Pro Plan 중 선택하세요.',
  },

  alternates: {
    canonical: '/pricing',
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
