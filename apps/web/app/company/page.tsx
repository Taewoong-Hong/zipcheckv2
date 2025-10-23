import Link from "next/link";
import { ChevronLeft, MapPin, Phone, Mail, Building2, User, FileText, Globe } from "lucide-react";
import Image from "next/image";

export default function CompanyPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/" className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold">회사소개</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center">
              <Image
                src="/logo-black.png"
                alt="집체크"
                width={50}
                height={50}
                className="object-contain"
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-1">집체크 (ZipCheck)</h2>
              <p className="text-white/90">AI 기반 부동산 계약 리스크 분석 서비스</p>
            </div>
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-primary" />
            회사 정보
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-neutral-500 min-w-[100px]">회사명</span>
              <span className="text-neutral-800 font-medium">아워</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-neutral-500 min-w-[100px]">대표자</span>
              <span className="text-neutral-800">이우리</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-neutral-500 min-w-[100px]">설립일</span>
              <span className="text-neutral-800">2024년 10월 30일</span>
            </div>
          </div>
        </div>

        {/* Business Registration */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-primary" />
            사업자 등록 정보
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-neutral-500 min-w-[100px]">사업자번호</span>
              <span className="text-neutral-800 font-mono">533-15-02502</span>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-brand-primary" />
            연락처 정보
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-neutral-400 mt-0.5" />
              <div>
                <p className="text-neutral-800">인천광역시 중구 인중로 290 A동 1108호</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-neutral-400" />
              <a href="mailto:hourhong@zipcheck.kr" className="text-brand-primary hover:underline">
                hourhong@zipcheck.kr
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-neutral-400" />
              <a href="https://www.zipcheck.kr" target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline">
                www.zipcheck.kr
              </a>
            </div>
          </div>
        </div>

        {/* Service Info */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-neutral-800 mb-4">서비스 소개</h3>
          <p className="text-neutral-600 leading-relaxed mb-4">
            집체크는 AI 기술을 활용하여 부동산 계약서의 리스크를 분석하고,
            안전한 부동산 거래를 도와드리는 프롭테크(PropTech) 서비스입니다.
          </p>
          <p className="text-neutral-600 leading-relaxed mb-4">
            다중 고급 AI 기술과 부동산 전문 지식을 결합하여,
            일반 소비자도 쉽게 계약서의 문제점을 파악하고 대응할 수 있도록 지원합니다.
          </p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="text-center p-4 bg-neutral-50 rounded-lg">
              <div className="text-2xl font-bold text-brand-primary mb-1">10,000+</div>
              <div className="text-sm text-neutral-600">누적 사용자</div>
            </div>
            <div className="text-center p-4 bg-neutral-50 rounded-lg">
              <div className="text-2xl font-bold text-brand-primary mb-1">50,000+</div>
              <div className="text-sm text-neutral-600">분석 완료 계약서</div>
            </div>
            <div className="text-center p-4 bg-neutral-50 rounded-lg">
              <div className="text-2xl font-bold text-brand-primary mb-1">98%</div>
              <div className="text-sm text-neutral-600">사용자 만족도</div>
            </div>
            <div className="text-center p-4 bg-neutral-50 rounded-lg">
              <div className="text-2xl font-bold text-brand-primary mb-1">24/7</div>
              <div className="text-sm text-neutral-600">AI 상담 가능</div>
            </div>
          </div>
        </div>

        {/* Legal Notice */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-red-900 mb-3">⚠️ 서비스 이용 안내</h3>
          <p className="text-red-800 text-sm leading-relaxed">
            집체크가 제공하는 AI 분석 결과는 참고용이며, 법적 조언을 대체할 수 없습니다.
            중요한 부동산 거래는 반드시 전문가(변호사, 공인중개사)와 상담하시기 바랍니다.
          </p>
        </div>

        {/* Policy Links */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-primary" />
            정책 및 약관
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link
              href="/terms?tab=terms"
              className="p-4 border border-neutral-200 rounded-lg hover:border-brand-primary hover:bg-brand-primary/5 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-neutral-800 group-hover:text-brand-primary mb-1">
                    이용약관
                  </h4>
                  <p className="text-sm text-neutral-500">
                    서비스 이용 조건 및 규정
                  </p>
                </div>
                <ChevronLeft className="w-5 h-5 text-neutral-400 rotate-180 group-hover:text-brand-primary" />
              </div>
            </Link>
            <Link
              href="/terms?tab=privacy"
              className="p-4 border border-neutral-200 rounded-lg hover:border-brand-primary hover:bg-brand-primary/5 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-neutral-800 group-hover:text-brand-primary mb-1">
                    개인정보 보호 정책
                  </h4>
                  <p className="text-sm text-neutral-500">
                    개인정보 처리 및 보호 방침
                  </p>
                </div>
                <ChevronLeft className="w-5 h-5 text-neutral-400 rotate-180 group-hover:text-brand-primary" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}