"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Shield, Calendar, Globe } from "lucide-react";
import termsData from "@/zipcheck_terms_ko.json";

export default function TermsContent() {
  const [activeSection, setActiveSection] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Scroll to top when section changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSection]);

  const sectionTitles = [
    { id: 0, title: "전체보기", icon: <FileText className="w-4 h-4" /> },
    ...termsData.sections.map(section => ({
      id: section.article,
      title: `${section.article}. ${section.title}`,
      icon: section.article <= 3 ? <Shield className="w-4 h-4" /> : <FileText className="w-4 h-4" />
    }))
  ];

  const renderSectionContent = (section: any) => {
    if (section.definitions) {
      return (
        <div className="space-y-3">
          {Object.entries(section.definitions).map(([key, value]) => (
            <div key={key} className="pl-4 border-l-2 border-brand-light/30">
              <dt className="font-semibold text-neutral-700 mb-1">"{key}"</dt>
              <dd className="text-neutral-600">{value as string}</dd>
            </div>
          ))}
        </div>
      );
    }

    if (section.rules) {
      return (
        <ul className="space-y-2">
          {section.rules.map((rule: string, index: number) => (
            <li key={index} className="flex items-start">
              <span className="text-brand-primary mr-2 mt-1">•</span>
              <span className="text-neutral-600 flex-1">{rule}</span>
            </li>
          ))}
        </ul>
      );
    }

    if (section.prohibited) {
      return (
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
          {section.account_security && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800">
                <strong>⚠️ 중요:</strong> {section.account_security}
              </p>
            </div>
          )}
        </div>
      );
    }

    if (section.may_defer || section.may_reject) {
      return (
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
      );
    }

    if (section.cases) {
      return (
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
          {section.liability && (
            <div className="mt-4 p-4 bg-neutral-100 border border-neutral-300 rounded-lg">
              <p className="text-neutral-700">{section.liability}</p>
            </div>
          )}
          {section.shutdown && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{section.shutdown}</p>
            </div>
          )}
        </div>
      );
    }

    if (section.body) {
      return <p className="text-neutral-600 leading-relaxed">{section.body}</p>;
    }

    return null;
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar Navigation - Desktop */}
      <aside className="hidden lg:block w-80 bg-white border-r border-neutral-200 fixed left-0 top-0 h-full overflow-y-auto">
        <div className="p-6 border-b border-neutral-200 bg-gradient-to-r from-brand-primary to-brand-secondary">
          <Link href="/" className="flex items-center gap-3 text-white">
            <ChevronLeft className="w-5 h-5" />
            <span className="font-bold text-lg">집체크 이용약관</span>
          </Link>
        </div>

        <div className="p-4">
          <div className="mb-4 p-3 bg-neutral-100 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-neutral-600 mb-1">
              <Calendar className="w-4 h-4" />
              <span>시행일: {termsData.versioning.effective_date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Globe className="w-4 h-4" />
              <span>버전: v{termsData.versioning.version}</span>
            </div>
          </div>

          <nav className="space-y-1">
            {sectionTitles.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                  activeSection === section.id
                    ? "bg-brand-primary text-white font-medium"
                    : "hover:bg-neutral-100 text-neutral-700"
                }`}
              >
                <span className={activeSection === section.id ? "text-white" : "text-neutral-400"}>
                  {section.icon}
                </span>
                <span className="text-sm">{section.title}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Footer Info */}
        <div className="p-4 mt-8 border-t border-neutral-200">
          <div className="space-y-2">
            <Link
              href="/privacy"
              className="text-sm text-brand-primary hover:underline block"
            >
              개인정보처리방침 →
            </Link>
            <a
              href={termsData.service.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-neutral-500 hover:text-neutral-700 block"
            >
              {termsData.service.website}
            </a>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-neutral-200 z-50">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="flex items-center gap-2 text-neutral-800">
            <ChevronLeft className="w-5 h-5" />
            <span className="font-bold">이용약관</span>
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-neutral-100"
          >
            <div className="space-y-1">
              <div className="w-5 h-0.5 bg-neutral-600"></div>
              <div className="w-5 h-0.5 bg-neutral-600"></div>
              <div className="w-5 h-0.5 bg-neutral-600"></div>
            </div>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed right-0 top-0 w-72 h-full bg-white z-50 overflow-y-auto">
              <div className="p-4 border-b border-neutral-200 bg-gradient-to-r from-brand-primary to-brand-secondary text-white">
                <div className="flex items-center justify-between">
                  <span className="font-bold">목차</span>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <nav className="p-4 space-y-1">
                {sectionTitles.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      activeSection === section.id
                        ? "bg-brand-primary text-white"
                        : "hover:bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>
          </>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-80 pt-16 lg:pt-0">
        <div className="max-w-4xl mx-auto p-6 lg:p-12">
          {/* Header */}
          <div className="mb-8 pb-6 border-b border-neutral-200">
            <h1 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-2">
              집체크 서비스 이용약관
            </h1>
            <p className="text-neutral-500">
              최종 수정일: {termsData.versioning.last_updated} | 시행일: {termsData.versioning.effective_date}
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-lg max-w-none">
            {activeSection === 0 ? (
              // Show all sections
              <div className="space-y-12">
                {termsData.sections.map((section) => (
                  <section key={section.article} className="scroll-mt-20">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-neutral-900 mb-4 flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 bg-brand-primary text-white rounded-full text-sm">
                          {section.article}
                        </span>
                        {section.title}
                      </h2>
                      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
                        {renderSectionContent(section)}
                      </div>
                    </div>
                  </section>
                ))}

                {/* Additional Sections */}
                <section className="scroll-mt-20">
                  <h2 className="text-2xl font-bold text-neutral-900 mb-4">
                    개인정보 보호
                  </h2>
                  <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
                    <ul className="space-y-3 text-neutral-600">
                      {termsData.privacy_cross_reference.notes.map((note, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-brand-primary mr-2 mt-1">•</span>
                          <span className="flex-1">{note}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={termsData.privacy_cross_reference.policy_url}
                      className="inline-flex items-center gap-2 mt-4 text-brand-primary hover:text-brand-secondary transition-colors"
                    >
                      개인정보처리방침 보기
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </section>

                <section className="scroll-mt-20">
                  <h2 className="text-2xl font-bold text-neutral-900 mb-4">
                    서비스별 안내사항
                  </h2>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                    <ul className="space-y-3 text-amber-800">
                      {termsData.service_specific_notices.map((notice, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-amber-600 mr-2 mt-1">⚡</span>
                          <span className="flex-1">{notice}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                {/* Legal Basis */}
                <section className="scroll-mt-20">
                  <h2 className="text-2xl font-bold text-neutral-900 mb-4">
                    관련 법령
                  </h2>
                  <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {termsData.legal_basis_refs.map((law, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-neutral-600">
                          <Shield className="w-4 h-4 text-neutral-400" />
                          <span>{law}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              // Show specific section
              <section>
                {(() => {
                  const section = termsData.sections.find(s => s.article === activeSection);
                  if (!section) return null;

                  return (
                    <div className="bg-white rounded-xl border border-neutral-200 p-8 shadow-sm">
                      <h2 className="text-2xl font-bold text-neutral-900 mb-6 flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 bg-brand-primary text-white rounded-full text-sm">
                          {section.article}
                        </span>
                        {section.title}
                      </h2>
                      {renderSectionContent(section)}
                    </div>
                  );
                })()}
              </section>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="mt-12 pt-8 border-t border-neutral-200">
            <div className="flex justify-between items-center">
              <button
                onClick={() => setActiveSection(Math.max(0, activeSection - 1))}
                disabled={activeSection === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  activeSection === 0
                    ? "text-neutral-400 cursor-not-allowed"
                    : "text-brand-primary hover:bg-brand-primary hover:text-white"
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
                이전
              </button>

              <div className="flex gap-1">
                {[0, ...termsData.sections.map(s => s.article)].map((id) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      activeSection === id
                        ? "bg-brand-primary w-8"
                        : "bg-neutral-300 hover:bg-neutral-400"
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={() => setActiveSection(Math.min(termsData.sections.length, activeSection + 1))}
                disabled={activeSection === termsData.sections[termsData.sections.length - 1].article}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  activeSection === termsData.sections[termsData.sections.length - 1].article
                    ? "text-neutral-400 cursor-not-allowed"
                    : "text-brand-primary hover:bg-brand-primary hover:text-white"
                }`}
              >
                다음
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}