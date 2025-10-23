"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, CreditCard, Check, AlertCircle } from "lucide-react";
import { loadTossPayments, TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { supabase } from "@/lib/supabase";

// 플랜 정보 타입
type PlanType = "personal" | "pro";
type BillingCycle = "monthly" | "yearly";

interface PlanInfo {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
}

const PLANS: Record<PlanType, PlanInfo> = {
  personal: {
    name: "Personal Plan",
    monthlyPrice: 7900,
    yearlyPrice: 7110,
    features: [
      "등기부 발급·열람 월 3건 포함",
      "등기부 PDF 업로드 OCR 분석 월 5건",
      "AI 분석 고급 모드 이용",
      "기본 저장공간 1GB",
      "등기부 모니터링 변동 알림 최대 3개 주소",
    ],
  },
  pro: {
    name: "Pro Plan",
    monthlyPrice: 19900,
    yearlyPrice: 17910,
    features: [
      "등기부 발급·열람 월 10건 포함",
      "등기부 PDF 업로드 OCR 분석 무제한",
      "다중 고급 모델을 이용한 AI 분석",
      "기본 저장공간 20GB",
      "등기부 모니터링 변동 알림 실시간",
      "위험도 리포트 자동 생성 무제한",
      "실거래가·경매 낙찰가 교차 비교",
    ],
  },
};

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [plan, setPlan] = useState<PlanType>("personal");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [isLoading, setIsLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgetsReady, setWidgetsReady] = useState(false);

  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const paymentWidgetRef = useRef<HTMLDivElement>(null);
  const agreementWidgetRef = useRef<HTMLDivElement>(null);

  // URL 파라미터에서 플랜 정보 가져오기
  useEffect(() => {
    const planParam = searchParams.get("plan") as PlanType;
    const cycleParam = searchParams.get("cycle") as BillingCycle;

    if (planParam && (planParam === "personal" || planParam === "pro")) {
      setPlan(planParam);
    }
    if (cycleParam && (cycleParam === "monthly" || cycleParam === "yearly")) {
      setBillingCycle(cycleParam);
    }
  }, [searchParams]);

  // 로그인된 사용자 정보 자동 입력
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const user = session.user;
          const userMetadata = user.user_metadata;

          // 이메일 자동 입력 (Supabase Auth에서 제공)
          if (user.email) {
            setCustomerEmail(user.email);
          }

          // 이름 자동 입력 (Google OAuth user_metadata에서 제공)
          if (userMetadata?.full_name) {
            setCustomerName(userMetadata.full_name);
          } else if (userMetadata?.name) {
            setCustomerName(userMetadata.name);
          }

          // 휴대폰 번호 자동 입력 (user_metadata에서 제공되는 경우)
          if (userMetadata?.phone) {
            setCustomerPhone(userMetadata.phone);
          } else if (userMetadata?.phone_number) {
            setCustomerPhone(userMetadata.phone_number);
          }
        }
      } catch (error) {
        console.error("사용자 정보 로드 오류:", error);
        // 에러가 발생해도 계속 진행 (사용자가 수동으로 입력 가능)
      }
    };

    loadUserData();
  }, []);

  const selectedPlan = PLANS[plan];
  const price = billingCycle === "yearly" ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;
  const originalPrice = selectedPlan.monthlyPrice;
  const totalPrice = billingCycle === "yearly" ? price * 12 : price;
  const discount = billingCycle === "yearly" ? (originalPrice - price) * 12 : 0;

  // 결제위젯 초기화
  useEffect(() => {
    const initializeWidgets = async () => {
      try {
        // 토스페이먼츠 위젯 클라이언트 키 (결제위젯용)
        const clientKey = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

        // customerKey 생성 (실제로는 서버에서 관리해야 함)
        const customerKey = customerEmail
          ? `CUSTOMER_${customerEmail.replace(/[^a-zA-Z0-9\-_.=@]/g, "_")}`
          : `CUSTOMER_GUEST_${Date.now()}`;

        // 위젯 로드
        const tossPayments = await loadTossPayments(clientKey);
        const widgets = tossPayments.widgets({ customerKey });

        // 금액 설정
        await widgets.setAmount({
          currency: "KRW",
          value: totalPrice,
        });

        widgetsRef.current = widgets;
        setWidgetsReady(true);
      } catch (err) {
        console.error("위젯 초기화 오류:", err);
        setError("결제 위젯을 불러오는 중 오류가 발생했습니다.");
      }
    };

    initializeWidgets();
  }, [totalPrice, customerEmail]);

  // 위젯 렌더링
  useEffect(() => {
    if (!widgetsReady || !widgetsRef.current) return;

    const renderWidgets = async () => {
      try {
        // 결제수단 위젯 렌더링
        if (paymentWidgetRef.current) {
          await widgetsRef.current!.renderPaymentMethods({
            selector: "#payment-widget",
            variantKey: "DEFAULT",
          });
        }

        // 약관 위젯 렌더링
        if (agreementWidgetRef.current) {
          await widgetsRef.current!.renderAgreement({
            selector: "#agreement-widget",
            variantKey: "AGREEMENT",
          });
        }
      } catch (err) {
        console.error("위젯 렌더링 오류:", err);
        setError("결제 화면을 표시하는 중 오류가 발생했습니다.");
      }
    };

    renderWidgets();
  }, [widgetsReady]);

  // 금액 변경 시 위젯 업데이트
  useEffect(() => {
    if (widgetsRef.current) {
      widgetsRef.current.setAmount({
        currency: "KRW",
        value: totalPrice,
      });
    }
  }, [totalPrice]);

  // 입력값 검증
  const validateInputs = (): boolean => {
    setError(null);

    if (!customerName.trim()) {
      setError("이름을 입력해주세요.");
      return false;
    }

    if (!customerEmail.trim()) {
      setError("이메일을 입력해주세요.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      setError("올바른 이메일 형식을 입력해주세요.");
      return false;
    }

    if (!customerPhone.trim()) {
      setError("휴대폰 번호를 입력해주세요.");
      return false;
    }

    return true;
  };

  // 빌링키 발급 및 결제 처리
  const handlePayment = async () => {
    if (!validateInputs()) return;
    if (!widgetsRef.current) {
      setError("결제 위젯이 준비되지 않았습니다.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 주문 ID 생성 (실제로는 서버에서 생성)
      const orderId = `ORDER_${Date.now()}`;
      const orderName = `${selectedPlan.name} - ${billingCycle === "yearly" ? "연간" : "월간"} 구독`;

      // customerKey 생성
      const customerKey = `CUSTOMER_${customerEmail.replace(/[^a-zA-Z0-9\-_.=@]/g, "_")}`;

      // 결제 요청 (빌링키 발급)
      await widgetsRef.current.requestPayment({
        orderId: orderId,
        orderName: orderName,
        successUrl: `${window.location.origin}/checkout/success?billingKey=true`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerEmail: customerEmail,
        customerName: customerName,
        customerMobilePhone: customerPhone,
      });
    } catch (err: any) {
      console.error("결제 오류:", err);

      // 위젯 에러 처리
      if (err?.code) {
        setError(getWidgetErrorMessage(err.code));
      } else {
        setError("결제 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 위젯 에러 메시지 변환
  const getWidgetErrorMessage = (errorCode: string): string => {
    const errorMessages: Record<string, string> = {
      INVALID_CUSTOMER_KEY: "고객 정보가 올바르지 않습니다.",
      BELOW_ZERO_AMOUNT: "결제 금액은 0원보다 커야 합니다.",
      INVALID_AMOUNT_VALUE: "결제 금액이 올바르지 않습니다.",
      NOT_SELECTED_PAYMENT_METHOD: "결제수단을 선택해주세요.",
      NEED_AGREEMENT_WITH_REQUIRED_TERMS: "필수 약관에 동의해주세요.",
      INVALID_PARAMETERS: "입력 정보를 확인해주세요.",
      USER_CANCEL: "결제가 취소되었습니다.",
      PROVIDER_STATUS_UNHEALTHY: "카드사/은행 시스템 점검 중입니다. 잠시 후 다시 시도해주세요.",
      UNKNOWN: "알 수 없는 오류가 발생했습니다.",
    };

    return errorMessages[errorCode] || "결제 중 오류가 발생했습니다.";
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-neutral-900">구독 결제</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 mb-1">오류</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: 주문자 정보 + 결제위젯 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 주문자 정보 */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">주문자 정보</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="example@zipcheck.kr"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    휴대폰 번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* 결제수단 위젯 */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">결제수단</h2>
              <div id="payment-widget" ref={paymentWidgetRef}></div>
            </div>

            {/* 약관 위젯 */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <div id="agreement-widget" ref={agreementWidgetRef}></div>

              {/* 추가 약관 */}
              <div className="mt-4 pt-4 border-t border-neutral-200">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-brand-primary border-neutral-300 rounded focus:ring-2 focus:ring-brand-primary"
                  />
                  <span className="text-sm text-neutral-600 leading-relaxed flex-1">
                    (필수){" "}
                    <Link href="/terms?tab=terms" target="_blank" className="text-brand-primary hover:underline">
                      이용약관
                    </Link>
                    {" "}및{" "}
                    <Link href="/terms?tab=privacy" target="_blank" className="text-brand-primary hover:underline">
                      개인정보 보호 정책
                    </Link>
                    에 동의합니다.
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Right: 주문 요약 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-neutral-200 p-6 sticky top-24">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">주문 요약</h2>

              {/* 플랜 정보 */}
              <div className="mb-6 pb-6 border-b border-neutral-200">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-neutral-900">{selectedPlan.name}</h3>
                    <p className="text-sm text-neutral-500">
                      {billingCycle === "yearly" ? "연간 구독" : "월간 구독"}
                    </p>
                  </div>
                  <div className="text-right">
                    {billingCycle === "yearly" && (
                      <p className="text-sm text-neutral-400 line-through">
                        ₩{originalPrice.toLocaleString()}/월
                      </p>
                    )}
                    <p className="font-semibold text-neutral-900">
                      ₩{price.toLocaleString()}/월
                    </p>
                  </div>
                </div>

                {/* 주요 기능 */}
                <div className="mt-4 space-y-2">
                  {selectedPlan.features.slice(0, 3).map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                      <span className="text-xs text-neutral-600">{feature}</span>
                    </div>
                  ))}
                  {selectedPlan.features.length > 3 && (
                    <p className="text-xs text-neutral-500 pl-6">
                      +{selectedPlan.features.length - 3}개 더보기
                    </p>
                  )}
                </div>
              </div>

              {/* 가격 정보 */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">
                    {billingCycle === "yearly" ? "연간 요금" : "월간 요금"}
                  </span>
                  <span className="text-neutral-900">
                    ₩{(billingCycle === "yearly" ? price * 12 : price).toLocaleString()}
                  </span>
                </div>

                {billingCycle === "yearly" && discount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">할인 금액</span>
                    <span className="text-brand-primary font-medium">
                      -₩{discount.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-neutral-200 flex items-center justify-between">
                  <span className="font-semibold text-neutral-900">첫 결제 금액</span>
                  <span className="text-2xl font-bold text-neutral-900">
                    ₩{totalPrice.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 자동결제 안내 */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-900 leading-relaxed">
                  💳 <strong>자동결제 안내</strong><br/>
                  첫 결제 후 매{billingCycle === "yearly" ? "년" : "월"} 자동으로 결제됩니다.
                  언제든지 구독을 취소할 수 있습니다.
                </p>
              </div>

              {/* 환불 정책 안내 */}
              {billingCycle === "yearly" && (
                <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-900 leading-relaxed">
                    <strong>📋 연간 구독 환불 정책</strong><br/>
                    • 구독 취소 시 언제든지 환불 가능합니다.<br/>
                    • 환불 금액은 <strong>월간 정가 기준</strong>으로 계산됩니다.<br/>
                    • 연간 할인 혜택은 환불 시 적용되지 않습니다.<br/>
                    • 환불액 = (월간 정가 × 남은 개월 수) - 이용료
                  </p>
                  <div className="mt-2 pt-2 border-t border-amber-300">
                    <p className="text-xs text-amber-800">
                      <strong>예시:</strong> {selectedPlan.name} 연간 구독 6개월 사용 후 취소 시<br/>
                      환불액 = (₩{originalPrice.toLocaleString()} × 6개월) - 실제 사용료
                    </p>
                  </div>
                </div>
              )}

              {/* 결제 버튼 */}
              <button
                onClick={handlePayment}
                disabled={isLoading || !widgetsReady || !agreedToTerms}
                className="w-full py-3.5 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                {isLoading ? "처리 중..." : "구독 시작하기"}
              </button>

              <p className="text-xs text-neutral-500 text-center mt-4">
                안전한 결제를 위해 토스페이먼츠를 사용합니다
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
