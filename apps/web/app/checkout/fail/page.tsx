"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";

export default function CheckoutFailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 파라미터에서 에러 정보 추출
  const errorCode = searchParams.get("code");
  const errorMessage = searchParams.get("message");
  const orderId = searchParams.get("orderId");

  // 에러 코드별 사용자 친화적 메시지
  const getErrorDetails = (code: string | null, message: string | null) => {
    // 토스페이먼츠 에러 코드 매핑
    const errorDetails: Record<string, { title: string; description: string; canRetry: boolean }> = {
      PAY_PROCESS_CANCELED: {
        title: "결제가 취소되었습니다",
        description: "결제를 취소하셨습니다. 다시 시도하시려면 아래 버튼을 클릭해주세요.",
        canRetry: true,
      },
      PAY_PROCESS_ABORTED: {
        title: "결제 승인 실패",
        description: "결제 진행 중 승인에 실패했습니다. 카드 정보를 확인하거나 다른 카드로 시도해주세요.",
        canRetry: true,
      },
      REJECT_CARD_COMPANY: {
        title: "카드사 승인 거절",
        description: "카드사에서 결제를 거절했습니다. 카드사에 문의하시거나 다른 카드를 이용해주세요.",
        canRetry: true,
      },
      FAILED_CARD_COMPANY: {
        title: "카드사 시스템 점검 중",
        description: "카드사 시스템 점검 중입니다. 다른 카드를 이용하거나 잠시 후 다시 시도해주세요.",
        canRetry: true,
      },
      INVALID_CARD_INFO_RE_REGISTER: {
        title: "유효하지 않은 카드",
        description: "카드 정보가 올바르지 않습니다. 카드 정보를 확인하거나 다른 카드를 이용해주세요.",
        canRetry: true,
      },
      INVALID_STOPPED_CARD: {
        title: "정지된 카드",
        description: "정지된 카드입니다. 카드사에 문의하시거나 다른 카드를 이용해주세요.",
        canRetry: false,
      },
      INVALID_CARD_LOST_OR_STOLEN: {
        title: "분실/도난 카드",
        description: "분실 또는 도난 신고된 카드입니다. 다른 카드를 이용해주세요.",
        canRetry: false,
      },
      EXCEEDED_AMOUNT_LIMIT: {
        title: "한도 초과",
        description: "카드 한도를 초과했습니다. 다른 카드를 이용하거나 카드사에 문의해주세요.",
        canRetry: true,
      },
      INVALID_PASSWORD: {
        title: "비밀번호 오류",
        description: "결제 비밀번호가 일치하지 않습니다. 다시 시도해주세요.",
        canRetry: true,
      },
      COMMON_ERROR: {
        title: "일시적 오류",
        description: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        canRetry: true,
      },
      PROVIDER_STATUS_UNHEALTHY: {
        title: "결제 기관 오류",
        description: "카드사, 은행 등 결제 기관에 일시적 오류가 발생했습니다. 다른 결제수단을 이용하거나 잠시 후 다시 시도해주세요.",
        canRetry: true,
      },
      SUSPECTED_PHISHING_PAYMENT: {
        title: "보안 승인 거절",
        description: "보안상의 이유로 결제가 거절되었습니다. 고객센터로 문의해주세요.",
        canRetry: false,
      },
    };

    // 에러 코드가 있으면 매핑된 메시지 사용
    if (code && errorDetails[code]) {
      return errorDetails[code];
    }

    // 기본 에러 메시지
    return {
      title: "결제 실패",
      description: errorMessage || "결제 중 오류가 발생했습니다. 다시 시도해주세요.",
      canRetry: true,
    };
  };

  const errorDetails = getErrorDetails(errorCode, errorMessage);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-200 p-8 text-center">
        {/* 실패 아이콘 */}
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-red-600" />
        </div>

        {/* 타이틀 */}
        <h1 className="text-2xl font-bold text-neutral-900 mb-3">{errorDetails.title}</h1>
        <p className="text-neutral-600 mb-8">{errorDetails.description}</p>

        {/* 에러 정보 (디버깅용) */}
        {(errorCode || orderId) && (
          <div className="bg-neutral-50 rounded-xl p-6 mb-8 text-left">
            <h3 className="text-sm font-semibold text-neutral-700 mb-4">오류 정보</h3>
            <div className="space-y-3">
              {orderId && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">주문번호</span>
                  <span className="font-medium text-neutral-900 font-mono text-xs">{orderId}</span>
                </div>
              )}
              {errorCode && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">에러 코드</span>
                  <span className="font-medium text-neutral-900 font-mono text-xs">{errorCode}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="space-y-3">
          {errorDetails.canRetry && (
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center gap-2 w-full py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-secondary transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              <span>다시 시도하기</span>
            </button>
          )}

          <Link
            href="/pricing"
            className="flex items-center justify-center gap-2 w-full py-3 border border-neutral-300 text-neutral-700 rounded-xl font-semibold hover:bg-neutral-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>요금제 페이지로</span>
          </Link>

          <Link
            href="/"
            className="block w-full py-3 text-neutral-600 rounded-xl font-medium hover:text-neutral-900 transition-colors"
          >
            홈으로 돌아가기
          </Link>
        </div>

        {/* 고객센터 안내 */}
        <div className="mt-6 pt-6 border-t border-neutral-200">
          <p className="text-sm text-neutral-500 mb-3">
            문제가 계속되거나 도움이 필요하신가요?
          </p>
          <Link
            href="/company"
            className="inline-flex items-center gap-1 text-sm text-brand-primary hover:underline font-medium"
          >
            <span>고객센터 문의하기</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* 일반적인 해결 방법 */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl text-left">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 일반적인 해결 방법</h4>
          <ul className="text-xs text-blue-800 space-y-1.5">
            <li>• 카드 정보(번호, 유효기간, CVC)를 정확히 입력했는지 확인</li>
            <li>• 카드 한도가 충분한지 확인</li>
            <li>• 해외 결제 차단 설정이 되어있는지 확인</li>
            <li>• 다른 카드로 시도</li>
            <li>• 잠시 후 다시 시도</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
