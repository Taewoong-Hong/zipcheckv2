"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, Search, HelpCircle, MessageCircle, Shield, CreditCard, FileText, Settings } from "lucide-react";
import { JsonLd, createFAQSchema } from "@/components/seo/JsonLd";

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    id: "1",
    category: "서비스 이용",
    question: "집체크 AI는 어떤 서비스인가요?",
    answer: "집체크 AI는 부동산 계약서를 분석하고 리스크를 평가하는 AI 기반 서비스입니다. 임대차 계약서, 매매 계약서, 등기부등본 등을 업로드하면 AI가 자동으로 분석하여 잠재적인 위험 요소를 찾아내고, 안전한 거래를 위한 조언을 제공합니다."
  },
  {
    id: "2",
    category: "서비스 이용",
    question: "어떤 문서를 분석할 수 있나요?",
    answer: "PDF, DOC, DOCX, HWP 형식의 부동산 계약서, 등기부등본, 건축물대장 등 부동산 관련 문서를 분석할 수 있습니다. 스캔된 이미지 파일(JPG, PNG)도 OCR 기능을 통해 텍스트를 추출하여 분석 가능합니다."
  },
  {
    id: "3",
    category: "AI 분석",
    question: "AI 분석 결과는 얼마나 정확한가요?",
    answer: "집체크 AI는 OpenAI GPT-4 기반으로 높은 정확도를 제공하지만, AI 분석 결과는 참고용입니다. 중요한 계약은 반드시 전문가(변호사, 공인중개사)와 상담하시기를 권장합니다. AI는 명백한 리스크를 찾아내는 데 탁월하지만, 법적 조언을 대체할 수는 없습니다."
  },
  {
    id: "4",
    category: "AI 분석",
    question: "분석에 얼마나 시간이 걸리나요?",
    answer: "일반적인 계약서는 5-10초 내에 분석이 완료됩니다. 문서의 크기와 복잡도에 따라 시간이 달라질 수 있으며, 대용량 문서나 여러 파일을 동시에 분석할 경우 최대 30초까지 소요될 수 있습니다."
  },
  {
    id: "5",
    category: "개인정보",
    question: "업로드한 문서는 안전하게 보관되나요?",
    answer: "모든 문서는 암호화되어 안전하게 저장되며, 사용자 본인만 접근할 수 있습니다. 문서는 분석 목적으로만 사용되며, 제3자와 공유되지 않습니다. 원하시면 언제든지 업로드한 문서를 삭제할 수 있습니다."
  },
  {
    id: "6",
    category: "개인정보",
    question: "개인정보는 어떻게 처리되나요?",
    answer: "개인정보보호법에 따라 최소한의 정보만 수집하며, 수집된 정보는 서비스 제공 목적으로만 사용됩니다. 주민등록번호 등 민감정보는 자동으로 마스킹 처리되어 저장되며, 탈퇴 시 모든 개인정보는 즉시 삭제됩니다."
  },
  {
    id: "7",
    category: "요금",
    question: "서비스 이용 요금은 어떻게 되나요?",
    answer: "기본적인 채팅 상담은 무료로 제공됩니다. 문서 분석, 등기부 발급 대행 등 프리미엄 기능은 유료로 제공되며, 월 구독 요금제와 건당 결제 옵션을 선택할 수 있습니다. 자세한 요금은 요금제 페이지를 참고해주세요."
  },
  {
    id: "8",
    category: "요금",
    question: "환불은 가능한가요?",
    answer: "결제 후 7일 이내, 서비스를 전혀 사용하지 않은 경우 전액 환불이 가능합니다. 일부 사용한 경우 사용량에 비례하여 부분 환불이 가능합니다. 자세한 환불 정책은 이용약관을 참고해주세요."
  },
  {
    id: "9",
    category: "문서 관리",
    question: "분석한 문서를 다시 볼 수 있나요?",
    answer: "네, '내 분석' 메뉴에서 이전에 분석한 모든 문서와 결과를 확인할 수 있습니다. 검색 기능을 통해 특정 문서를 쉽게 찾을 수 있으며, 필요시 재분석도 가능합니다."
  },
  {
    id: "10",
    category: "기술 지원",
    question: "모바일에서도 사용할 수 있나요?",
    answer: "네, 집체크는 반응형 웹으로 제작되어 스마트폰, 태블릿 등 모든 기기에서 사용 가능합니다. 모바일에서도 문서 업로드와 AI 분석 기능을 동일하게 이용할 수 있습니다."
  }
];

const categories = [
  { name: "전체", icon: <HelpCircle className="w-4 h-4" /> },
  { name: "서비스 이용", icon: <MessageCircle className="w-4 h-4" /> },
  { name: "AI 분석", icon: <Settings className="w-4 h-4" /> },
  { name: "개인정보", icon: <Shield className="w-4 h-4" /> },
  { name: "요금", icon: <CreditCard className="w-4 h-4" /> },
  { name: "문서 관리", icon: <FileText className="w-4 h-4" /> },
  { name: "기술 지원", icon: <Settings className="w-4 h-4" /> }
];

export default function FAQPage() {
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const filteredFAQs = faqData.filter(item => {
    const matchesCategory = selectedCategory === "전체" || item.category === selectedCategory;
    const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleExpand = (id: string) => {
    setExpandedItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  // FAQ 구조화 데이터 생성
  const faqSchema = createFAQSchema(
    faqData.map(item => ({
      question: item.question,
      answer: item.answer,
    }))
  );

  return (
    <>
      <JsonLd data={faqSchema} />
      <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/" className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-neutral-800">자주 묻는 질문</h1>
              <p className="text-sm text-neutral-600 mt-1">집체크 서비스 이용에 대한 궁금증을 해결해드립니다</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="질문 검색..."
              className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-brand-primary transition-colors"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(category.name)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                  selectedCategory === category.name
                    ? "bg-brand-primary text-white"
                    : "bg-white text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {category.icon}
                <span className="text-sm font-medium">{category.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ List */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {filteredFAQs.length > 0 ? (
          <div className="space-y-4">
            {filteredFAQs.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-neutral-200 overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="w-full px-6 py-4 text-left hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-1 bg-brand-primary/10 text-brand-primary rounded font-medium">
                          {item.category}
                        </span>
                      </div>
                      <h3 className="font-medium text-neutral-800">
                        {item.question}
                      </h3>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-neutral-400 transition-transform ${
                        expandedItems.includes(item.id) ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {expandedItems.includes(item.id) && (
                  <div className="px-6 pb-4 border-t border-neutral-100">
                    <p className="text-neutral-600 leading-relaxed mt-4">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-neutral-200 p-12">
            <div className="text-center">
              <HelpCircle className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-700 mb-2">
                검색 결과가 없습니다
              </h3>
              <p className="text-sm text-neutral-500">
                다른 검색어를 시도하거나 카테고리를 변경해보세요
              </p>
            </div>
          </div>
        )}

        {/* Contact Section */}
        <div className="mt-12 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-xl p-8 text-white">
          <h2 className="text-xl font-bold mb-3">찾으시는 답변이 없나요?</h2>
          <p className="mb-6 opacity-90">
            고객센터로 문의하시면 신속하게 답변해드리겠습니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="mailto:support@zipcheck.kr"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-brand-primary rounded-lg font-medium hover:bg-neutral-100 transition-colors"
            >
              이메일 문의
            </a>
            <button className="px-6 py-3 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors">
              카카오톡 상담
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}