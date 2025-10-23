"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import LoginModal from "@/components/auth/LoginModal";

export default function PricingPage() {
  const router = useRouter();
  const [isYearly, setIsYearly] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<{ plan: string; cycle: string } | null>(null);

  // 로그인 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkAuth();

    // 로그인 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);

      // 로그인 성공 후 대기 중인 플랜이 있으면 체크아웃으로 이동
      if (session && pendingPlan) {
        router.push(`/checkout?plan=${pendingPlan.plan}&cycle=${pendingPlan.cycle}`);
        setPendingPlan(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [pendingPlan, router]);

  // 업그레이드 버튼 클릭 핸들러
  const handleUpgradeClick = (plan: "personal" | "pro") => {
    const cycle = isYearly ? "yearly" : "monthly";

    if (!isLoggedIn) {
      // 미로그인 시 플랜 정보 저장 후 로그인 모달 표시
      setPendingPlan({ plan, cycle });
      setShowLoginModal(true);
    } else {
      // 로그인 상태면 바로 체크아웃으로 이동
      router.push(`/checkout?plan=${plan}&cycle=${cycle}`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-9 px-3">
      {/* Close Button */}
      <div className="max-w-6xl mx-auto mb-6">
        <Link
          href="/"
          className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-neutral-200 transition-colors"
        >
          <X className="w-5 h-5 text-neutral-600" />
        </Link>
      </div>

      {/* Header */}
      <div className="max-w-6xl mx-auto text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-neutral-900 tracking-wider leading-tight">
          고급 기능을 이용하세요
        </h1>
        <h2 className="text-base md:text-lg mb-9 text-neutral-500 tracking-wide leading-tight">
          등기부 분석부터 등기부 변동 알람까지 한번에!
        </h2>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-4 mt-9">
          <span className={`text-lg ${!isYearly ? 'font-semibold text-neutral-900' : 'text-neutral-500'}`}>
            월간 결제
          </span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              isYearly ? "bg-brand-primary" : "bg-neutral-300"
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                isYearly ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-lg ${isYearly ? 'font-semibold text-neutral-900' : 'text-neutral-500'}`}>
              연간 결제
            </span>
            <span className="text-sm text-brand-primary font-semibold bg-brand-primary/10 px-2 py-1 rounded">
              10% 할인
            </span>
          </div>
        </div>

        {/* 연간 결제 환불 정책 안내 */}
        {isYearly && (
          <div className="max-w-2xl mx-auto mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-900 text-center leading-relaxed">
              <strong>📋 연간 구독 환불 정책:</strong> 구독 취소 시 언제든지 환불 가능합니다.
              단, 환불 금액은 <strong>월간 정가 기준</strong>으로 계산되며, 연간 할인 혜택은 적용되지 않습니다.
            </p>
          </div>
        )}
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6 mt-3 md:mt-4">
        {/* Personal Plan */}
        <div className="bg-white rounded-2xl border-2 border-neutral-200 p-8 flex flex-col min-h-[650px]">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-neutral-900 mb-3 tracking-wide">Personal Plan</h3>
            <div className="flex items-baseline gap-2 mb-2 h-12">
              {isYearly && (
                <span className="text-xl font-semibold text-neutral-400 line-through">₩7,900</span>
              )}
              <span className="text-4xl font-bold text-neutral-900">
                {isYearly ? "₩7,110" : "₩7,900"}
              </span>
              <span className="text-lg text-neutral-500">/월</span>
            </div>
            <p className="text-sm text-neutral-600 tracking-wide">
              개인 임차·매수자/집주인용 ✦ 가볍게 시작
            </p>
          </div>

          <ul className="space-y-4 mb-6 flex-1">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-sm leading-relaxed tracking-wide">등기부 발급·열람 월 3건 포함</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-sm leading-relaxed tracking-wide">등기부 PDF 업로드 OCR 분석 월 5건</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-sm leading-relaxed tracking-wide">AI 분석 고급 모드 이용</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-sm leading-relaxed tracking-wide">기본 저장공간 1GB (리포트·PDF 보관, 6개월 보존)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-sm leading-relaxed tracking-wide">등기부 모니터링 변동 알림 최대 3개 주소 (앱, 이메일)</span>
            </li>
          </ul>

          <div className="mb-4 p-2 bg-neutral-50 rounded-lg">
            <p className="text-xs text-neutral-600">
              <span className="font-medium">대상:</span> 임대차 혹은 매매계약 직전 사용하는 개인
            </p>
          </div>

          <button
            onClick={() => handleUpgradeClick("personal")}
            className="w-full py-3 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-colors"
          >
            업그레이드
          </button>
        </div>

        {/* Pro Plan */}
        <div className="bg-white rounded-2xl border-2 border-neutral-200 p-8 flex flex-col min-h-[650px]">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-neutral-900 mb-3 tracking-wide">Pro Plan</h3>
            <div className="flex items-baseline gap-2 mb-2 h-12">
              {isYearly && (
                <span className="text-xl font-semibold text-neutral-400 line-through">₩19,900</span>
              )}
              <span className="text-4xl font-bold text-neutral-900">
                {isYearly ? "₩17,910" : "₩19,900"}
              </span>
              <span className="text-lg text-neutral-500">/월</span>
            </div>
            <p className="text-sm text-neutral-600 tracking-wide">
              전·월세/매매 실무, 중개사/컨설턴트용 ✦ 확장형
            </p>
          </div>

          <ul className="space-y-4 mb-6 flex-1">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-sm leading-relaxed tracking-wide">등기부 발급·열람 월 10건 포함</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-sm leading-relaxed tracking-wide">등기부 PDF 업로드 OCR 분석 무제한</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-sm leading-relaxed tracking-wide">다중 고급 모델을 이용한 AI 분석</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-sm leading-relaxed tracking-wide">기본 저장공간 20GB (리포트·PDF 보관, 24개월 보존)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-sm leading-relaxed tracking-wide">등기부 모니터링 변동 알림 실시간 (앱, 이메일)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-sm leading-relaxed tracking-wide">위험도 리포트 자동 생성 무제한</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-neutral-900 shrink-0 mt-0.5" />
              <span className="text-neutral-700 text-sm leading-relaxed tracking-wide">실거래가·경매 낙찰가 교차 비교</span>
            </li>
          </ul>

          <div className="mb-4 p-2 bg-neutral-50 rounded-lg">
            <p className="text-xs text-neutral-600">
              <span className="font-medium">대상:</span> 공인중개사, 부동산 사업자, 전문가용
            </p>
          </div>

          <button
            onClick={() => handleUpgradeClick("pro")}
            className="w-full py-3 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-colors"
          >
            업그레이드
          </button>
        </div>
      </div>

      {/* 로그인 모달 */}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}
    </div>
  );
}
