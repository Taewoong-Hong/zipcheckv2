"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function NaverSuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const token = searchParams?.get("token");

        if (!token) {
          setStatus("error");
          setErrorMessage("토큰을 받지 못했습니다.");
          return;
        }

        // Supabase 클라이언트에 토큰 설정
        // Note: Supabase JS는 자체 세션 관리를 하므로,
        // 커스텀 JWT를 직접 설정하는 대신 localStorage에 저장합니다.
        localStorage.setItem("sb-access-token", token);

        // Supabase 클라이언트를 재설정하여 새 토큰 사용
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
          setStatus("error");
          setErrorMessage(error?.message || "사용자 정보를 가져오지 못했습니다.");
          return;
        }

        console.log("네이버 로그인 성공:", user);
        setStatus("success");

        // 1초 후 홈으로 리디렉션
        setTimeout(() => {
          router.push("/");
        }, 1000);
      } catch (err) {
        console.error("네이버 로그인 처리 오류:", err);
        setStatus("error");
        setErrorMessage("로그인 처리 중 오류가 발생했습니다.");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
        {status === "loading" && (
          <>
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-green-600"></div>
            <h2 className="mb-2 text-xl font-semibold text-gray-800">
              네이버 로그인 처리 중...
            </h2>
            <p className="text-sm text-gray-600">
              잠시만 기다려주세요.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
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
            <h2 className="mb-2 text-xl font-semibold text-gray-800">
              로그인 성공!
            </h2>
            <p className="text-sm text-gray-600">
              홈 페이지로 이동합니다...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
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
            <h2 className="mb-2 text-xl font-semibold text-gray-800">
              로그인 실패
            </h2>
            <p className="mb-4 text-sm text-gray-600">{errorMessage}</p>
            <button
              onClick={() => router.push("/")}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              홈으로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function NaverSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <NaverSuccessPageContent />
    </Suspense>
  );
}
