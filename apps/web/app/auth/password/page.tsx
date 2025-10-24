"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function PasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // 이메일이 없으면 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!email) {
      router.push("/");
    }
  }, [email, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email!,
        password: password,
      });

      if (signInError) {
        // 에러 메시지를 사용자 친화적으로 변환
        if (signInError.message.includes("Invalid login credentials")) {
          setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        } else if (signInError.message.includes("Email not confirmed")) {
          setError("이메일 인증이 필요합니다. 이메일을 확인해주세요.");
        } else {
          setError("로그인에 실패했습니다. 다시 시도해주세요.");
        }
        console.error("로그인 에러:", signInError);
        return;
      }

      if (data?.user) {
        console.log("로그인 성공:", data.user.email);
        // 홈으로 리다이렉트
        router.push("/");
      }
    } catch (err) {
      console.error("로그인 처리 오류:", err);
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) {
    return null; // 리다이렉트 처리 중
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block mb-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
              집체크
            </h1>
          </Link>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            비밀번호를 입력하세요
          </h2>
          <p className="text-sm text-neutral-600">{email}</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 비밀번호 입력 */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoFocus
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            />
          </div>

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-md text-sm font-medium hover:from-red-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "로그인 중..." : "로그인"}
          </button>

          {/* 다른 이메일로 로그인 */}
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full px-4 py-2.5 border border-neutral-300 text-neutral-700 rounded-md text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            다른 이메일로 로그인
          </button>
        </form>

        {/* 비밀번호 찾기 / 회원가입 링크 */}
        <div className="mt-6 text-center space-y-2">
          <Link
            href="/auth/reset-password"
            className="block text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
          >
            비밀번호를 잊으셨나요?
          </Link>
          <div className="text-sm text-neutral-600">
            계정이 없으신가요?{" "}
            <Link
              href="/auth/signup"
              className="text-red-600 hover:text-red-700 font-medium underline underline-offset-2"
            >
              회원가입
            </Link>
          </div>
        </div>

        {/* 약관 안내 */}
        <div className="mt-6 pt-6 border-t border-neutral-100">
          <p className="text-xs text-neutral-500 text-center leading-relaxed">
            로그인하면 집체크의{" "}
            <Link
              href="/terms?tab=terms"
              target="_blank"
              className="text-neutral-700 hover:text-neutral-900 underline underline-offset-2"
            >
              이용약관
            </Link>
            {" "}및{" "}
            <Link
              href="/terms?tab=privacy"
              target="_blank"
              className="text-neutral-700 hover:text-neutral-900 underline underline-offset-2"
            >
              개인정보 보호 정책
            </Link>
            에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-neutral-600">로딩 중...</p>
        </div>
      </div>
    }>
      <PasswordPageContent />
    </Suspense>
  );
}
