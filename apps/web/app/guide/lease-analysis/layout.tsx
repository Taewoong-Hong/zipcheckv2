import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '임대차 계약 분석 가이드',
  description: '전세, 월세 계약 전 필수 체크사항! AI가 등기부등본, 건축물대장, 시세를 자동으로 분석하여 계약 리스크를 평가합니다. 전세사기 예방을 위한 필수 가이드.',

  keywords: ['전세 분석', '월세 계약', '임대차 계약', '전세사기 예방', '등기부등본 분석', '전세가율', '보증금 리스크'],

  openGraph: {
    title: '임대차 계약 분석 가이드 | 집체크',
    description: '전세, 월세 계약 전 AI 자동 분석으로 리스크를 평가하세요',
    type: 'article',
    url: '/guide/lease-analysis',
  },

  twitter: {
    title: '임대차 계약 분석 가이드 | 집체크',
    description: '전세, 월세 계약 전 AI 자동 분석으로 리스크를 평가하세요',
  },

  alternates: {
    canonical: '/guide/lease-analysis',
  },
};

export default function LeaseAnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
