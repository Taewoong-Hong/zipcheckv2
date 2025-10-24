import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '자주 묻는 질문(FAQ)',
  description: '집체크 서비스 이용에 대한 궁금증을 해결해드립니다. 서비스 이용, AI 분석, 개인정보, 요금, 문서 관리 등 다양한 질문에 대한 답변을 확인하세요.',

  openGraph: {
    title: '자주 묻는 질문(FAQ) | 집체크',
    description: '집체크 서비스 이용에 대한 궁금증을 해결해드립니다.',
    type: 'website',
    url: '/faq',
  },

  twitter: {
    title: '자주 묻는 질문(FAQ) | 집체크',
    description: '집체크 서비스 이용에 대한 궁금증을 해결해드립니다.',
  },

  alternates: {
    canonical: '/faq',
  },
};

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
