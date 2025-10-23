"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import SocialLoginButton from "@/components/auth/SocialLoginButton";
import { Home } from "lucide-react";

export default function LoginPage() {
  const handleSocialLogin = (provider: "kakao" | "google" | "naver") => {
    // 백엔드 담당자가 연결할 로그인 로직
    console.log(`${provider} 로그인 시도`);
    // TODO: NextAuth signIn() 호출
    // signIn(provider, { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-neutral-50 flex items-center justify-center p-4">
      {/* 홈 버튼 */}
      <Link
        href="/"
        className="fixed top-6 left-6 flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 group"
      >
        <Home className="w-4 h-4 text-neutral-600 group-hover:text-red-600 transition-colors" />
        <span className="text-sm font-medium text-neutral-700 group-hover:text-red-600 transition-colors">
          홈으로
        </span>
      </Link>

      {/* 로그인 카드 */}
      <div className="w-full max-w-md">
        {/* 로고 및 타이틀 */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative w-20 h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl shadow-lg flex items-center justify-center">
              <span className="text-3xl font-bold text-white">집</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            집체크에 오신 것을 환영합니다
          </h1>
          <p className="text-neutral-600">
            간편하게 로그인하고 AI 부동산 분석을 시작하세요
          </p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="space-y-3">
            {/* 카카오 로그인 */}
            <SocialLoginButton
              provider="kakao"
              onClick={() => handleSocialLogin("kakao")}
            />

            {/* 구글 로그인 */}
            <SocialLoginButton
              provider="google"
              onClick={() => handleSocialLogin("google")}
            />

            {/* 네이버 로그인 */}
            <SocialLoginButton
              provider="naver"
              onClick={() => handleSocialLogin("naver")}
            />
          </div>

          {/* 구분선 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-neutral-500">
                소셜 계정으로 빠른 로그인
              </span>
            </div>
          </div>

          {/* 이용약관 */}
          <div className="text-center text-xs text-neutral-500">
            로그인 시{" "}
            <Link
              href="/terms"
              className="text-red-600 hover:text-red-700 underline underline-offset-2"
            >
              이용약관
            </Link>
            과{" "}
            <Link
              href="/terms"
              className="text-red-600 hover:text-red-700 underline underline-offset-2"
            >
              개인정보처리방침
            </Link>
            에 동의하게 됩니다.
          </div>
        </div>

        {/* 추가 정보 */}
        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-600">
            처음이신가요?{" "}
            <Link
              href="/guide/rental-checklist"
              className="font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              서비스 가이드 보기
            </Link>
          </p>
        </div>
      </div>

      {/* 배경 장식 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-20 left-1/2 w-72 h-72 bg-red-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
    </div>
  );
}
