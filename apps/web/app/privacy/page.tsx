import { Suspense } from "react";
import TermsContent from "@/components/terms/TermsContent";

export const metadata = {
  title: "개인정보 보호 정책 - 집체크",
  description: "집체크 개인정보 보호 정책을 확인하세요.",
};

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-neutral-600">로딩 중...</p>
        </div>
      </div>
    }>
      <TermsContent />
    </Suspense>
  );
}
