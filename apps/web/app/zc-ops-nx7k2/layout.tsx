export const metadata = {
  title: '집체크 관리자 - Internal Dashboard',
  description: 'ZipCheck Admin Dashboard',
  robots: 'noindex, nofollow', // 검색엔진 차단
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
