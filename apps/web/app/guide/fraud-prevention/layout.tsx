import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '전세사기 예방 가이드',
  description: '전세사기 피해를 예방하는 방법! 깡통전세 확인, 선순위 권리관계 체크, 전세보증보험 가입 등 필수 안전장치를 알려드립니다.',

  keywords: ['전세사기', '전세사기 예방', '깡통전세', '전세보증보험', '확정일자', '선순위 권리'],

  openGraph: {
    title: '전세사기 예방 가이드 | 집체크',
    description: '전세사기 피해를 예방하는 필수 체크사항을 확인하세요',
    type: 'article',
    url: '/guide/fraud-prevention',
  },

  alternates: {
    canonical: '/guide/fraud-prevention',
  },
};

export default function FraudPreventionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
