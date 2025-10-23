/**
 * OAuth Callback Page
 *
 * This page handles OAuth redirects from Google/Kakao/Naver.
 * It exchanges the code for a session and redirects to the home page.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error from OAuth provider
        const error = searchParams?.get("error");
        const errorDescription = searchParams?.get("error_description");

        if (error) {
          console.error("OAuth error:", error, errorDescription);
          setStatus("error");
          setErrorMessage(errorDescription || error);
          return;
        }

        // Exchange code for session using Supabase
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        if (exchangeError) {
          console.error("Session exchange error:", exchangeError);
          setStatus("error");
          setErrorMessage(exchangeError.message);
          return;
        }

        // Get current session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setStatus("error");
          setErrorMessage("세션을 생성하지 못했습니다.");
          return;
        }

        console.log("로그인 성공:", session.user.email);
        setStatus("success");

        // Redirect to home page after 1 second
        setTimeout(() => {
          router.push("/");
        }, 1000);

      } catch (err) {
        console.error("Unexpected error:", err);
        setStatus("error");
        setErrorMessage("로그인 처리 중 오류가 발생했습니다.");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              로그인 처리 중...
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
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              홈으로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
