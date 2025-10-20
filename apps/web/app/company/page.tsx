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
            <h1 className="text-2xl font-bold">사업자 정보</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center">
              <Image
                src="/logo-black.png"
                alt="ZipCheck"
                width={50}
                height={50}
                className="object-contain"
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-1">집체크(ZipCheck)</h2>
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
              <span className="text-neutral-800 font-medium">주식회사 집체크</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-neutral-500 min-w-[100px]">대표이사</span>
              <span className="text-neutral-800">홍길동</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-neutral-500 min-w-[100px]">설립일</span>
              <span className="text-neutral-800">2024년 1월 1일</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-neutral-500 min-w-[100px]">직원수</span>
              <span className="text-neutral-800">15명</span>
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
              <span className="text-neutral-800 font-mono">123-45-67890</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-neutral-500 min-w-[100px]">법인번호</span>
              <span className="text-neutral-800 font-mono">110111-7654321</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-neutral-500 min-w-[100px]">업태</span>
              <span className="text-neutral-800">정보통신업</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-neutral-500 min-w-[100px]">종목</span>
              <span className="text-neutral-800">소프트웨어 개발 및 공급업, 정보서비스업</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-neutral-500 min-w-[100px]">통신판매업</span>
              <span className="text-neutral-800">제2024-서울강남-0001호</span>
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
                <p className="text-neutral-800">서울특별시 강남구 테헤란로 123</p>
                <p className="text-neutral-600 text-sm">집체크빌딩 5층 (우) 06234</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-neutral-400" />
              <span className="text-neutral-800">02-1234-5678</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-neutral-400" />
              <a href="mailto:support@zipcheck.kr" className="text-brand-primary hover:underline">
                support@zipcheck.kr
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
            OpenAI GPT-4 기반의 최첨단 AI 기술과 부동산 전문 지식을 결합하여,
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-900 mb-3">법적 고지</h3>
          <p className="text-amber-800 text-sm leading-relaxed mb-3">
            집체크가 제공하는 AI 분석 서비스는 참고용이며, 법적 조언을 대체할 수 없습니다.
            중요한 부동산 거래는 반드시 전문가(변호사, 공인중개사)와 상담하시기 바랍니다.
          </p>
          <p className="text-amber-800 text-sm leading-relaxed">
            본 서비스 이용과 관련된 모든 법적 분쟁은 대한민국 법률에 따라 처리되며,
            서울중앙지방법원을 제1심 관할법원으로 합니다.
          </p>
        </div>
      </div>
    </div>
  );
}