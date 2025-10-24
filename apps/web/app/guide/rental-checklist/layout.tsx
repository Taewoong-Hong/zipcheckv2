import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '임대차 계약 체크리스트',
  description: '전월세 계약 시 반드시 확인해야 할 사항! 계약 전부터 입주까지 단계별 체크리스트를 제공합니다.',

  keywords: ['임대차 계약', '전월세 체크리스트', '계약 체크리스트', '입주 전 확인사항'],

  openGraph: {
    title: '임대차 계약 체크리스트 | 집체크',
    description: '전월세 계약 시 단계별 체크리스트를 확인하세요',
    type: 'article',
    url: '/guide/rental-checklist',
  },

  alternates: {
    canonical: '/guide/rental-checklist',
  },
};

export default function RentalChecklistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
