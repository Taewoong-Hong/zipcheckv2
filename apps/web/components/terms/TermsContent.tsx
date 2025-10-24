"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, FileText, Shield, Info } from "lucide-react";
import type { TermsData, TermsSection } from "@/types/terms";
import termsDataJson from "../../zipcheck_terms_ko.json";
import privacyDataJson from "../../zipcheck_privacy_ko.json";

const termsData = termsDataJson as TermsData;
const privacyData = privacyDataJson as any;

type TabType = "terms" | "privacy";

export default function TermsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("terms");
  const [expandedSections, setExpandedSections] = useState<number[]>([]);

  // URL 파라미터 또는 현재 경로로 탭 초기화
  useEffect(() => {
    // URL 파라미터 확인
    const tab = searchParams.get("tab");
    if (tab === "privacy" || tab === "terms") {
      setActiveTab(tab);
    } else {
      // 현재 경로가 /privacy이면 privacy 탭 자동 선택
      if (typeof window !== "undefined" && window.location.pathname === "/privacy") {
        setActiveTab("privacy");
      }
    }
  }, [searchParams]);

  // 탭 변경 시 URL 업데이트
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // 선택적으로 URL 업데이트
    const newUrl = `/terms?tab=${tab}`;
    window.history.pushState({}, "", newUrl);
  };

  // 섹션 토글
  const toggleSection = (articleNum: number) => {
    if (expandedSections.includes(articleNum)) {
      setExpandedSections(expandedSections.filter((num) => num !== articleNum));
    } else {
      setExpandedSections([...expandedSections, articleNum]);
    }
  };

  // 이용약관 섹션 렌더링
  const renderTermsSection = (section: TermsSection) => {
    const isExpanded = expandedSections.includes(section.article);

    return (
      <div
        key={section.article}
        className="border border-neutral-200 rounded-xl overflow-hidden mb-4"
      >
        <button
          onClick={() => toggleSection(section.article)}
          className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-neutral-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 bg-brand-primary text-white rounded-full text-sm font-semibold">
              {section.article}
            </span>
            <h3 className="text-lg font-semibold text-neutral-900 text-left">
              {section.title}
            </h3>
          </div>
          <svg
            className={`w-5 h-5 text-neutral-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isExpanded && (
          <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200">
            {section.body && (
              <p className="text-neutral-600 leading-relaxed mb-4">{section.body}</p>
            )}

            {section.definitions && (
              <div className="space-y-3">
                {Object.entries(section.definitions).map(([key, value]) => (
                  <div key={key} className="pl-4 border-l-2 border-brand-light/30">
                    <dt className="font-semibold text-neutral-700 mb-1">&ldquo;{key}&rdquo;</dt>
                    <dd className="text-neutral-600">{value as string}</dd>
                  </div>
                ))}
              </div>
            )}

            {section.rules && (
              <ul className="space-y-2">
                {section.rules.map((rule: string, index: number) => (
                  <li key={index} className="flex items-start">
                    <span className="text-brand-primary mr-2 mt-1">•</span>
                    <span className="text-neutral-600 flex-1">{rule}</span>
                  </li>
                ))}
              </ul>
            )}

            {section.prohibited && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-neutral-800 mb-3">금지행위</h4>
                  <ul className="space-y-2">
                    {section.prohibited.map((item: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-red-500 mr-2 mt-1">✕</span>
                        <span className="text-neutral-600 flex-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {(section.may_defer || section.may_reject) && (
              <div className="space-y-4">
                {section.may_defer && (
                  <div>
                    <h4 className="font-semibold text-neutral-800 mb-3">승낙 유보 사유</h4>
                    <ul className="space-y-2">
                      {section.may_defer.map((item: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <span className="text-amber-500 mr-2 mt-1">⚡</span>
                          <span className="text-neutral-600 flex-1">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {section.may_reject && (
                  <div>
                    <h4 className="font-semibold text-neutral-800 mb-3">승낙 거절 사유</h4>
                    <ul className="space-y-2">
                      {section.may_reject.map((item: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <span className="text-red-500 mr-2 mt-1">✕</span>
                          <span className="text-neutral-600 flex-1">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {section.cases && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-neutral-800 mb-3">서비스 중지 사유</h4>
                  <ul className="space-y-2">
                    {section.cases.map((item: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-neutral-400 mr-2 mt-1">•</span>
                        <span className="text-neutral-600 flex-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {section.maintenance && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800">{section.maintenance}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 개인정보 보호 정책 섹션 렌더링
  const renderPrivacySection = (section: any) => {
    const isExpanded = expandedSections.includes(section.article);

    return (
      <div
        key={section.article}
        className="border border-neutral-200 rounded-xl overflow-hidden mb-4"
      >
        <button
          onClick={() => toggleSection(section.article)}
          className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-neutral-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 bg-red-600 text-white rounded-full text-sm font-semibold">
              {section.article}
            </span>
            <h3 className="text-lg font-semibold text-neutral-900 text-left">
              {section.title}
            </h3>
          </div>
          <svg
            className={`w-5 h-5 text-neutral-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isExpanded && (
          <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200">
            {section.body && (
              <p className="text-neutral-600 leading-relaxed mb-4">{section.body}</p>
            )}

            {/* purposes */}
            {section.purposes && (
              <div className="space-y-4">
                {section.purposes.map((purpose: any, index: number) => (
                  <div key={index}>
                    <h4 className="font-semibold text-neutral-800 mb-2">
                      {purpose.category}
                    </h4>
                    <ul className="space-y-1 ml-4">
                      {purpose.items.map((item: string, i: number) => (
                        <li key={i} className="flex items-start">
                          <span className="text-red-500 mr-2 mt-1">•</span>
                          <span className="text-neutral-600 flex-1">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* collection_methods */}
            {section.collection_methods && (
              <div className="space-y-4">
                {section.collection_methods.map((method: any, index: number) => (
                  <div key={index} className="border-l-2 border-red-200 pl-4">
                    <h4 className="font-semibold text-neutral-800 mb-2">
                      {method.method}
                    </h4>
                    <div className="space-y-2">
                      {method.required.length > 0 && (
                        <div>
                          <p className="text-sm text-red-700 font-medium">[필수]</p>
                          <ul className="ml-4 space-y-1">
                            {method.required.map((item: string, i: number) => (
                              <li key={i} className="text-neutral-600 text-sm">
                                • {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {method.optional.length > 0 && (
                        <div>
                          <p className="text-sm text-neutral-500 font-medium">[선택]</p>
                          <ul className="ml-4 space-y-1">
                            {method.optional.map((item: string, i: number) => (
                              <li key={i} className="text-neutral-600 text-sm">
                                • {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* retention_periods */}
            {section.retention_periods && (
              <div className="space-y-3">
                {section.retention_periods.map((item: any, index: number) => {
                  if (item.items) {
                    return (
                      <div key={index} className="bg-white border border-neutral-200 rounded-lg p-4">
                        <h4 className="font-semibold text-neutral-800 mb-2">
                          {item.category}
                        </h4>
                        <ul className="space-y-2">
                          {item.items.map((subitem: any, i: number) => (
                            <li key={i} className="flex justify-between items-start text-sm">
                              <span className="text-neutral-600">{subitem.item}</span>
                              <span className="text-red-600 font-medium ml-4">
                                {subitem.period}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                  return (
                    <div key={index} className="flex justify-between items-start bg-white border border-neutral-200 rounded-lg p-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-neutral-800 mb-1">
                          {item.category}
                        </h4>
                        {item.note && (
                          <p className="text-xs text-neutral-500">{item.note}</p>
                        )}
                      </div>
                      <span className="text-red-600 font-medium ml-4">{item.period}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* third_party_provision */}
            {section.third_party_provision && (
              <div className="space-y-3">
                {section.third_party_provision.map((item: any, index: number) => (
                  <div key={index} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-semibold text-amber-900 mb-2">
                      {item.recipient}
                    </h4>
                    <ul className="space-y-1 text-sm text-amber-800">
                      <li><strong>목적:</strong> {item.purpose}</li>
                      <li><strong>항목:</strong> {item.items.join(", ")}</li>
                      <li><strong>보유기간:</strong> {item.retention}</li>
                      {item.note && <li className="text-xs text-amber-700 mt-2">{item.note}</li>}
                    </ul>
                  </div>
                ))}
                {section.no_provision_note && (
                  <p className="text-neutral-600 text-sm mt-2">{section.no_provision_note}</p>
                )}
              </div>
            )}

            {/* consignment */}
            {section.consignment && (
              <div className="space-y-3">
                {section.consignment.map((item: any, index: number) => (
                  <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-1">{item.trustee}</h4>
                    <p className="text-sm text-blue-800">• {item.task}</p>
                    <p className="text-xs text-blue-700 mt-1">{item.period}</p>
                  </div>
                ))}
                {section.management && (
                  <p className="text-neutral-600 text-sm mt-3">{section.management}</p>
                )}
              </div>
            )}

            {/* rights */}
            {section.rights && (
              <ul className="space-y-2">
                {section.rights.map((right: string, index: number) => (
                  <li key={index} className="flex items-start">
                    <span className="text-red-500 mr-2 mt-1">•</span>
                    <span className="text-neutral-600 flex-1">{right}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* exercise_method */}
            {section.exercise_method && (
              <div className="space-y-3 mt-4">
                {section.exercise_method.map((method: any, index: number) => (
                  <div key={index} className="bg-white border border-neutral-200 rounded-lg p-4">
                    <h4 className="font-semibold text-neutral-800 mb-2">
                      {method.method}
                    </h4>
                    <ul className="text-sm text-neutral-600 space-y-1">
                      {method.available.map((item: string, i: number) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                {section.response_period && (
                  <p className="text-neutral-600 text-sm mt-3">{section.response_period}</p>
                )}
              </div>
            )}

            {/* security_measures */}
            {section.security_measures && (
              <div className="space-y-3">
                {section.security_measures.map((item: any, index: number) => (
                  <div key={index} className="bg-neutral-100 border border-neutral-200 rounded-lg p-4">
                    <h4 className="font-semibold text-neutral-800 mb-2">{item.measure}</h4>
                    <ul className="text-sm text-neutral-600 space-y-1">
                      {item.details.map((detail: string, i: number) => (
                        <li key={i}>• {detail}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* cookie */}
            {section.what_is_cookie && (
              <div className="space-y-3">
                <p className="text-neutral-600">{section.what_is_cookie}</p>
                {section.cookie_purpose && (
                  <div>
                    <h4 className="font-semibold text-neutral-800 mb-2">쿠키 사용 목적</h4>
                    <ul className="space-y-1">
                      {section.cookie_purpose.map((purpose: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <span className="text-neutral-400 mr-2 mt-1">•</span>
                          <span className="text-neutral-600 flex-1">{purpose}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {section.cookie_refuse && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
                    <p className="text-amber-800 mb-2">{section.cookie_refuse.description}</p>
                    <div className="text-sm text-amber-700 space-y-1">
                      {section.cookie_refuse.methods.map((method: string, index: number) => (
                        <p key={index}>• {method}</p>
                      ))}
                    </div>
                    {section.cookie_refuse.note && (
                      <p className="text-xs text-amber-600 mt-2">{section.cookie_refuse.note}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* officer */}
            {section.officer && (
              <div className="bg-white border border-neutral-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-neutral-500">이름:</span>
                    <span className="ml-2 font-medium text-neutral-800">{section.officer.name}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">직책:</span>
                    <span className="ml-2 font-medium text-neutral-800">{section.officer.position}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-neutral-500">이메일:</span>
                    <span className="ml-2 font-medium text-neutral-800">{section.officer.email}</span>
                  </div>
                </div>
                {section.contact_info && (
                  <p className="text-neutral-600 text-sm mt-3">{section.contact_info}</p>
                )}
              </div>
            )}

            {/* agencies */}
            {section.agencies && (
              <div className="space-y-3">
                {section.agencies.map((agency: any, index: number) => (
                  <div key={index} className="bg-white border border-neutral-200 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-neutral-800">{agency.name}</h4>
                      <p className="text-sm text-neutral-600">전화: {agency.phone}</p>
                    </div>
                    <a
                      href={`https://${agency.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:text-red-700 text-sm underline"
                    >
                      {agency.website}
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* 기타 텍스트 필드 */}
            {section.destruction_procedure && (
              <div className="space-y-2">
                <p className="text-neutral-600 text-sm">{section.destruction_procedure}</p>
              </div>
            )}
            {section.destruction_method && (
              <div className="space-y-2 mt-3">
                <h4 className="font-semibold text-neutral-800">파기 방법</h4>
                {section.destruction_method.map((item: any, index: number) => (
                  <div key={index} className="text-sm text-neutral-600">
                    <strong>{item.type}:</strong> {item.method}
                  </div>
                ))}
              </div>
            )}
            {section.notice_period && (
              <p className="text-neutral-600 text-sm mt-3">{section.notice_period}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="flex items-center gap-2 text-neutral-800 hover:text-neutral-600">
              <ChevronLeft className="w-5 h-5" />
              <span className="font-semibold">홈으로</span>
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-neutral-200">
            <button
              onClick={() => handleTabChange("terms")}
              className={`px-6 py-3 font-medium transition-colors relative ${
                activeTab === "terms"
                  ? "text-brand-primary"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>이용약관</span>
              </div>
              {activeTab === "terms" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary" />
              )}
            </button>
            <button
              onClick={() => handleTabChange("privacy")}
              className={`px-6 py-3 font-medium transition-colors relative ${
                activeTab === "privacy"
                  ? "text-red-600"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>개인정보 보호 정책</span>
              </div>
              {activeTab === "privacy" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === "terms" ? (
          <>
            {/* 이용약관 헤더 */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                집체크 서비스 이용약관
              </h1>
              <p className="text-neutral-500 text-sm">
                최종 수정일: {termsData.versioning.last_updated} | 시행일:{" "}
                {termsData.versioning.effective_date}
              </p>
            </div>

            {/* 이용약관 섹션 */}
            <div className="space-y-3">
              {termsData.sections.map((section) => renderTermsSection(section))}
            </div>

            {/* 서비스별 안내사항 */}
            <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <Info className="w-5 h-5" />
                서비스별 안내사항
              </h3>
              <ul className="space-y-2 text-amber-800">
                {termsData.service_specific_notices.map((notice, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-amber-600 mr-2 mt-1">⚡</span>
                    <span className="flex-1">{notice}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 개인정보 보호 정책 링크 */}
            <div className="mt-6 p-4 bg-neutral-100 border border-neutral-200 rounded-xl">
              <p className="text-sm text-neutral-600">
                개인정보 처리에 대한 자세한 내용은{" "}
                <button
                  onClick={() => handleTabChange("privacy")}
                  className="text-red-600 hover:text-red-700 font-medium underline underline-offset-2"
                >
                  개인정보 보호 정책
                </button>
                을 참고해주세요.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* 개인정보 보호 정책 헤더 */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                개인정보 보호 정책
              </h1>
              <p className="text-neutral-500 text-sm">
                최종 수정일: {privacyData.versioning.last_updated} | 시행일:{" "}
                {privacyData.versioning.effective_date}
              </p>
            </div>

            {/* 개인정보 보호 정책 섹션 */}
            <div className="space-y-3">
              {privacyData.sections.map((section: any) => renderPrivacySection(section))}
            </div>

            {/* AI 관련 안내사항 */}
            {privacyData.ai_specific_notices && (
              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  AI 서비스 관련 안내사항
                </h3>
                <ul className="space-y-2 text-blue-800">
                  {privacyData.ai_specific_notices.map((notice: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-600 mr-2 mt-1">ℹ️</span>
                      <span className="flex-1">{notice}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 이용약관 링크 */}
            <div className="mt-6 p-4 bg-neutral-100 border border-neutral-200 rounded-xl">
              <p className="text-sm text-neutral-600">
                서비스 이용 조건 및 규정에 대한 자세한 내용은{" "}
                <button
                  onClick={() => handleTabChange("terms")}
                  className="text-red-600 hover:text-red-700 font-medium underline underline-offset-2"
                >
                  이용약관
                </button>
                을 참고해주세요.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
