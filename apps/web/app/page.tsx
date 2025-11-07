import HomeClient from "@/components/HomeClient";

// 임시로 동적 강제 (Vercel 빌드 에러 회피)
// 근본 원인 해결 후 이 줄 제거 가능
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <HomeClient />;
}
