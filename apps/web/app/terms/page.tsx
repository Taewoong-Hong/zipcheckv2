import TermsContent from "@/components/terms/TermsContent";

export const metadata = {
  title: "이용약관 - 집체크(ZipCheck)",
  description: "집체크 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-neutral-100">
      <TermsContent />
    </div>
  );
}