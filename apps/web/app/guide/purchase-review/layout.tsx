import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '매매 계약서 검토 가이드',
  description: '부동산 매매 계약 전 필수 체크사항! AI가 매매계약서, 등기부등본, 시세를 분석하여 안전한 거래를 돕습니다.',

  keywords: ['매매 계약', '부동산 매매', '계약서 검토', '등기부등본', '매매 리스크'],

  openGraph: {
    title: '매매 계약서 검토 가이드 | 집체크',
    description: '부동산 매매 계약 전 AI 자동 분석으로 안전한 거래를 보장하세요',
    type: 'article',
    url: '/guide/purchase-review',
  },

  alternates: {
    canonical: '/guide/purchase-review',
  },
};

export default function PurchaseReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
