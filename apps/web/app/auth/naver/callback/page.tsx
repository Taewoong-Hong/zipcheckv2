/**
 * Naver OAuth Callback Page
 *
 * This page handles Naver OAuth redirects.
 * It exchanges the code for a session and redirects to the home page.
 */

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Force dynamic rendering for OAuth callback
export const dynamic = 'force-dynamic';

function NaverCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get code and state from URL
        const code = searchParams?.get("code");
        const state = searchParams?.get("state");
        const error = searchParams?.get("error");
        const errorDescription = searchParams?.get("error_description");

        if (error) {
          console.error("Naver OAuth error:", error, errorDescription);
          setStatus("error");
          setErrorMessage(errorDescription || error);
          return;
        }

        if (!code || !state) {
          setStatus("error");
          setErrorMessage("인증 코드가 없습니다.");
          return;
        }

        // Verify CSRF token
        const savedState = sessionStorage.getItem("naver_oauth_state");
        if (state !== savedState) {
          setStatus("error");
          setErrorMessage("잘못된 요청입니다. (CSRF 검증 실패)");
          return;
        }

        // Clear saved state
        sessionStorage.removeItem("naver_oauth_state");

        // Exchange code for tokens via backend
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_AI_API_URL}/auth/naver/exchange`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ code, state }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "토큰 교환 실패");
        }

        const data = await response.json();
        console.log("Naver 로그인 성공:", data.user.email);

        // Create Supabase session with Naver user data
        // Note: This requires custom backend implementation to create Supabase user
        // For now, just redirect to home
        setStatus("success");

        // Redirect to home page after 1 second
        setTimeout(() => {
          router.push("/");
        }, 1000);

      } catch (err) {
        console.error("Unexpected error:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "로그인 처리 중 오류가 발생했습니다.");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              네이버 로그인 처리 중...
            </h2>
            <p className="text-sm text-neutral-600">
              잠시만 기다려 주세요.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              로그인 성공!
            </h2>
            <p className="text-sm text-neutral-600">
              홈 페이지로 이동합니다...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              로그인 실패
            </h2>
            <p className="text-sm text-neutral-600 mb-4">
              {errorMessage || "알 수 없는 오류가 발생했습니다."}
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              홈으로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function NaverCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-neutral-600">로딩 중...</p>
        </div>
      </div>
    }>
      <NaverCallbackPageContent />
    </Suspense>
  );
}
