import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '부동산 가이드',
  description: '전세 분석, 매매 검토, 전세사기 예방, 임대차 체크리스트 등 부동산 거래 시 필수 정보를 확인하세요.',

  openGraph: {
    title: '부동산 가이드 | 집체크',
    description: '전세 분석, 매매 검토, 전세사기 예방 등 부동산 거래 가이드',
    type: 'website',
  },

  twitter: {
    title: '부동산 가이드 | 집체크',
    description: '전세 분석, 매매 검토, 전세사기 예방 등 부동산 거래 가이드',
  },
};

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
