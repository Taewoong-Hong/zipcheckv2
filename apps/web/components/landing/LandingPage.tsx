"use client";

import React, { useState } from "react";
import Link from "next/link";
import LoginModal from "@/components/auth/LoginModal";

export default function LandingPage() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-neutral-50 to-neutral-100">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 로고 */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-white">집</span>
              </div>
              <span className="text-xl font-bold text-gray-900">집체크</span>
            </div>

            {/* 네비게이션 */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                로그인
              </button>
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-4 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                무료로 회원 가입
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="pt-16">
        {/* 히어로 섹션 */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            지금 무슨 생각을 하시나요?
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            AI를 활용한 부동산 계약서 분석으로 더 스마트한 홈딜을 경험하세요
          </p>

          {/* 입력창 (로그인 유도) */}
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="w-full px-6 py-4 bg-white border border-neutral-300 rounded-xl text-left text-gray-500 hover:border-neutral-400 hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <span className="flex-1">무엇이든 물어보세요</span>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <kbd className="px-2 py-1 bg-neutral-100 rounded border border-neutral-300 group-hover:border-neutral-400">
                    첨부
                  </kbd>
                  <kbd className="px-2 py-1 bg-neutral-100 rounded border border-neutral-300 group-hover:border-neutral-400">
                    검색
                  </kbd>
                  <kbd className="px-2 py-1 bg-neutral-100 rounded border border-neutral-300 group-hover:border-neutral-400">
                    학습하기
                  </kbd>
                </div>
              </div>
            </button>
          </div>
        </section>

        {/* 기능 소개 섹션 */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-neutral-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 기능 1 */}
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                계약서 분석
              </h3>
              <p className="text-sm text-gray-600">
                부동산 계약서를 업로드하고 AI가 자동으로 리스크를 분석합니다
              </p>
            </div>

            {/* 기능 2 */}
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-pink-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                실시간 상담
              </h3>
              <p className="text-sm text-gray-600">
                궁금한 점을 물어보고 AI 전문가의 답변을 즉시 받아보세요
              </p>
            </div>

            {/* 기능 3 */}
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                리스크 점검
              </h3>
              <p className="text-sm text-gray-600">
                잠재적인 법적 리스크를 미리 파악하고 안전하게 계약하세요
              </p>
            </div>
          </div>
        </section>

        {/* CTA 섹션 */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            지금 시작해보세요
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            로그인에 더 스마트한 홈딜, 파일 및 이미지 업로드를 다양한 기능을
            이용할 수 있습니다.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="px-8 py-3 bg-black text-white rounded-lg text-base font-medium hover:bg-gray-800 transition-colors min-w-[200px]"
            >
              무료로 회원 가입
            </button>
            <Link
              href="/guide/rental-checklist"
              className="px-8 py-3 bg-white text-gray-900 border border-neutral-300 rounded-lg text-base font-medium hover:bg-neutral-50 transition-colors min-w-[200px]"
            >
              서비스 가이드 보기
            </Link>
          </div>
        </section>

        {/* 푸터 */}
        <footer className="border-t border-neutral-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">
                  서비스
                </h4>
                <ul className="space-y-2">
                  <li>
                    <Link
                      href="/guide/rental-checklist"
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      임대차 점검
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/guide/purchase-review"
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      매매 검토
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/guide/lease-analysis"
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      전월세 분석
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">
                  고객지원
                </h4>
                <ul className="space-y-2">
                  <li>
                    <Link
                      href="/faq"
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      FAQ
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/pricing"
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      요금제
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">
                  회사
                </h4>
                <ul className="space-y-2">
                  <li>
                    <Link
                      href="/company"
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      사업자정보
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/terms"
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      이용약관
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">
                  집체크
                </h4>
                <p className="text-sm text-gray-600">
                  AI를 활용한 부동산 계약 리스크 분석 서비스
                </p>
              </div>
            </div>

            <div className="pt-8 border-t border-neutral-200">
              <p className="text-center text-sm text-gray-500">
                © 2025 ZipCheck. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>

      {/* 로그인 모달 */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
}
