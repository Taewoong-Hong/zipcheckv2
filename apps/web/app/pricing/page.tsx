"use client";

import React, { useState } from "react";
import Link from "next/link";
import { X, Check } from "lucide-react";

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      {/* Close Button */}
      <div className="max-w-6xl mx-auto mb-8">
        <Link
          href="/"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-neutral-200 transition-colors"
        >
          <X className="w-6 h-6 text-neutral-600" />
        </Link>
      </div>

      {/* Header */}
      <div className="max-w-6xl mx-auto text-center mb-16">
        <h1 className="text-5xl md:text-6xl font-bold mb-4 text-neutral-900 tracking-wide leading-tight">
          고급 기능을 이용하세요
        </h1>
        <h2 className="text-xl md:text-2xl mb-12 text-neutral-500 tracking-wide leading-tight">
          등기부 분석부터 등기부 변동 알람까지 한번에!
        </h2>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-6 mt-12">
          <span className={`text-xl ${!isYearly ? 'font-semibold text-neutral-900' : 'text-neutral-500'}`}>
            월간 결제
          </span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={`w-16 h-8 rounded-full transition-colors relative ${
              isYearly ? "bg-brand-primary" : "bg-neutral-300"
            }`}
          >
            <div
              className={`absolute top-0.5 w-7 h-7 bg-white rounded-full transition-transform ${
                isYearly ? "translate-x-8" : "translate-x-0.5"
              }`}
            />
          </button>
          <div className="flex items-center gap-3">
            <span className={`text-xl ${isYearly ? 'font-semibold text-neutral-900' : 'text-neutral-500'}`}>
              연간 결제
            </span>
            <span className="text-base text-brand-primary font-semibold bg-brand-primary/10 px-3 py-1.5 rounded">
              10% 할인
            </span>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 mt-4 md:mt-6">
        {/* Personal Plan */}
        <div className="bg-white rounded-2xl border-2 border-neutral-200 p-10 flex flex-col">
          <div className="mb-8">
            <h3 className="text-3xl font-bold text-neutral-900 mb-4 tracking-wide">Personal Plan</h3>
            <div className="flex items-baseline gap-2 mb-2 h-16">
              {isYearly && (
                <span className="text-2xl font-semibold text-neutral-400 line-through">₩6,900</span>
              )}
              <span className="text-5xl font-bold text-neutral-900">
                {isYearly ? "₩6,210" : "₩6,900"}
              </span>
              <span className="text-xl text-neutral-500">/월</span>
            </div>
            <p className="text-base text-neutral-600 tracking-wide">
              개인 임차·매수자/집주인용 ✦ 가볍게 시작
            </p>
          </div>

          <ul className="space-y-5 mb-8 flex-1">
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-base leading-relaxed tracking-wide">등기부 발급·열람 월 3건 포함</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-base leading-relaxed tracking-wide">등기부 PDF 업로드 OCR 분석 월 5건</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-base leading-relaxed tracking-wide">빠른 고급 모델 1개 사용</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-base leading-relaxed tracking-wide">기본 저장공간 1GB (리포트·PDF 보관, 6개월 보존)</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-base leading-relaxed tracking-wide">등기부 모니터링 변동 알림 최대 3개 주소 (앱, 이메일)</span>
            </li>
          </ul>

          <div className="mb-6 p-3 bg-neutral-50 rounded-lg">
            <p className="text-sm text-neutral-600">
              <span className="font-medium">대상:</span> 임대차 혹은 매매계약 직전 사용하는 개인
            </p>
          </div>

          <button className="w-full py-4 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-colors">
            업그레이드
          </button>
        </div>

        {/* Pro Plan */}
        <div className="bg-white rounded-2xl border-2 border-neutral-200 p-10 relative flex flex-col">

          <div className="mb-8">
            <h3 className="text-3xl font-bold text-neutral-900 mb-4 tracking-wide">Pro Plan</h3>
            <div className="flex items-baseline gap-2 mb-2 h-16">
              {isYearly && (
                <span className="text-2xl font-semibold text-neutral-400 line-through">₩19,900</span>
              )}
              <span className="text-5xl font-bold text-neutral-900">
                {isYearly ? "₩17,910" : "₩19,900"}
              </span>
              <span className="text-xl text-neutral-500">/월</span>
            </div>
            <p className="text-base text-neutral-600 tracking-wide">
              전·월세/매매 실무, 중개사/컨설턴트용 ✦ 확장형
            </p>
          </div>

          <ul className="space-y-5 mb-8 flex-1">
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-base leading-relaxed tracking-wide">등기부 발급·열람 월 10건 포함</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-base leading-relaxed tracking-wide">등기부 PDF 업로드 OCR 분석 무제한</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-base leading-relaxed tracking-wide">빠른 고급 모델 2개 동시 선택(고속/정확 모드)</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-base leading-relaxed tracking-wide">위험도 리포트 자동 생성 무제한</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-base leading-relaxed tracking-wide">실거래가·경매 낙찰가 교차 비교</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-base leading-relaxed tracking-wide">기본 저장공간 20GB (리포트·PDF 보관, 24개월 보존)</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-base leading-relaxed tracking-wide">등기부 모니터링 변동 알림 실시간 (앱, 이메일)</span>
            </li>
          </ul>

          <div className="mb-6 p-3 bg-neutral-50 rounded-lg">
            <p className="text-sm text-neutral-600">
              <span className="font-medium">대상:</span> 공인중개사, 부동산 사업자, 전문가용
            </p>
          </div>

          <button className="w-full py-4 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-colors">
            업그레이드
          </button>
        </div>
      </div>
    </div>
  );
}
