"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function CheckoutSuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // URL 파라미터에서 결제 정보 추출
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");
  const isBilling = searchParams.get("billingKey") === "true";

  useEffect(() => {
    // 결제 승인 처리 (실제로는 백엔드 API 호출)
    const verifyPayment = async () => {
      if (!paymentKey || !orderId || !amount) {
        setVerificationError("결제 정보가 올바르지 않습니다.");
        setIsVerifying(false);
        return;
      }

      try {
        // TODO: 백엔드 API 호출하여 결제 승인
        // const response = await fetch('/api/payments/confirm', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ paymentKey, orderId, amount }),
        // });

        // 임시: 2초 대기 후 성공 처리
        await new Promise((resolve) => setTimeout(resolve, 2000));

        setIsVerifying(false);
      } catch (error) {
        console.error("결제 승인 오류:", error);
        setVerificationError("결제 승인 중 오류가 발생했습니다. 고객센터로 문의해주세요.");
        setIsVerifying(false);
      }
    };

    verifyPayment();
  }, [paymentKey, orderId, amount]);

  // 검증 중 로딩 화면
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-brand-primary animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">결제를 확인하고 있습니다</h2>
          <p className="text-neutral-600">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

  // 검증 실패 화면
  if (verificationError) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-neutral-900 mb-3">결제 확인 실패</h1>
          <p className="text-neutral-600 mb-8">{verificationError}</p>

          <div className="space-y-3">
            <Link
              href="/pricing"
              className="block w-full py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-secondary transition-colors"
            >
              다시 시도하기
            </Link>
            <Link
              href="/"
              className="block w-full py-3 border border-neutral-300 text-neutral-700 rounded-xl font-semibold hover:bg-neutral-50 transition-colors"
            >
              홈으로 돌아가기
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-200">
            <p className="text-sm text-neutral-500">
              문제가 지속되면{" "}
              <Link href="/company" className="text-brand-primary hover:underline">
                고객센터
              </Link>
              로 문의해주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 성공 화면
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-200 p-8 text-center">
        {/* 성공 아이콘 */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>

        {/* 타이틀 */}
        <h1 className="text-2xl font-bold text-neutral-900 mb-3">
          {isBilling ? "구독이 시작되었습니다!" : "결제가 완료되었습니다!"}
        </h1>
        <p className="text-neutral-600 mb-8">
          {isBilling
            ? "집체크 프리미엄 서비스가 활성화되었습니다. 자동결제가 설정되었습니다."
            : "집체크 프리미엄 서비스를 이용하실 수 있습니다."}
        </p>

        {/* 결제 정보 */}
        <div className="bg-neutral-50 rounded-xl p-6 mb-8 text-left">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4">결제 정보</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">주문번호</span>
              <span className="font-medium text-neutral-900">{orderId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">결제금액</span>
              <span className="font-medium text-neutral-900">
                ₩{Number(amount).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">결제수단</span>
              <span className="font-medium text-neutral-900">신용/체크카드</span>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="space-y-3">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-secondary transition-colors"
          >
            <span>서비스 시작하기</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/company"
            className="block w-full py-3 border border-neutral-300 text-neutral-700 rounded-xl font-semibold hover:bg-neutral-50 transition-colors"
          >
            고객센터
          </Link>
        </div>

        {/* 안내 문구 */}
        <div className="mt-6 pt-6 border-t border-neutral-200">
          <p className="text-sm text-neutral-500 mb-2">
            결제 내역은 이메일로 발송되었습니다.
          </p>
          {isBilling && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-left">
              <p className="text-xs text-blue-900 leading-relaxed">
                <strong>💳 자동결제 안내</strong><br/>
                다음 결제일에 자동으로 결제됩니다.<br/>
                구독 관리는 마이페이지에서 할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-neutral-600">로딩 중...</p>
        </div>
      </div>
    }>
      <CheckoutSuccessPageContent />
    </Suspense>
  );
}
