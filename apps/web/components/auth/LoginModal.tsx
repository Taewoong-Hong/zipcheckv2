"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import SocialLoginButton from "./SocialLoginButton";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { OverlayLoader } from "@/components/common/LoadingSpinner";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");

  // 이메일 "계속" 버튼 핸들러
  const handleEmailContinue = async () => {
    if (!email) {
      alert("이메일을 입력해주세요.");
      return;
    }
    // 이메일 유효성 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("올바른 이메일 형식을 입력해주세요.");
      return;
    }

    setIsLoading(true);

    try {
      // 로그인 시도로 기존 사용자 확인
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: 'dummy_password_for_check', // 임시 비밀번호
      });

      if (signInError) {
        // "Invalid login credentials" → 계정이 존재함 (비밀번호만 틀림)
        if (signInError.message.includes("Invalid login credentials")) {
          // 기존 사용자 → 비밀번호 입력 페이지
          window.location.href = `/auth/password?email=${encodeURIComponent(email)}`;
        }
        // "Email not confirmed" → 계정 존재하지만 이메일 미인증
        else if (signInError.message.includes("Email not confirmed")) {
          alert("이메일 인증이 필요합니다. 이메일을 확인해주세요.");
          setIsLoading(false);
        }
        // 그 외 에러 → 신규 사용자로 간주
        else {
          // 신규 사용자 → 회원가입 페이지
          window.location.href = `/auth/signup?email=${encodeURIComponent(email)}`;
        }
      } else {
        // 로그인 성공 (비밀번호가 'dummy_password_for_check'인 경우는 거의 없음)
        window.location.href = "/";
      }
    } catch (error) {
      console.error("이메일 확인 중 오류:", error);
      // 에러 발생 시 회원가입 페이지로 이동
      window.location.href = `/auth/signup?email=${encodeURIComponent(email)}`;
    }
  };

  const handleSocialLogin = async (provider: "kakao" | "google" | "naver") => {
    // 소셜 로그인은 진행 시 약관 동의로 간주

    setIsLoading(true);
    console.log(`${provider} 로그인 시도`);

    try {
      if (provider === "google") {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            // Let the browser SDK handle the code exchange and persist session
            redirectTo: `${window.location.origin}`,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });

        if (error) {
          console.error("Google 로그인 오류:", error);
          alert(`로그인 실패: ${error.message}`);
        } else if (data?.url) {
          // OAuth URL로 리다이렉트
          window.location.href = data.url;
        }
      } else if (provider === "kakao") {
        // Supabase Kakao OAuth
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "kakao",
          options: {
            // Let the browser SDK handle the code exchange and persist session
            redirectTo: `${window.location.origin}`,
          },
        });

        if (error) {
          console.error("Kakao 로그인 오류:", error);
          alert(`로그인 실패: ${error.message}`);
        } else if (data?.url) {
          // OAuth URL로 리다이렉트
          window.location.href = data.url;
        }
      } else if (provider === "naver") {
        // Naver OAuth via Supabase Edge Function
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gsiismzchtgdklvdvggu.supabase.co';
        const currentOrigin = window.location.origin; // localhost:3000 또는 zipcheck.kr
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/naver?return_url=${encodeURIComponent(currentOrigin)}`;
        window.location.href = edgeFunctionUrl;
      }
    } catch (err) {
      console.error("로그인 오류:", err);
      alert("로그인 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // 모달이 열릴 때 body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* 로딩 오버레이 */}
      {isLoading && <OverlayLoader text="로그인 중..." />}

      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        {/* 배경 오버레이 */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm animate-slideUp">
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
          aria-label="모달 닫기"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 헤더 */}
        <div className="text-center pt-8 pb-6 px-6 border-b border-neutral-100">
          <h2
            id="login-modal-title"
            className="text-xl font-semibold text-gray-900 mb-1"
          >
            로그인 또는 회원 가입
          </h2>
          <p className="text-sm text-neutral-600">
            계약서 분석, 파일 업로드 등 더 많은 기능을 이용할 수 있습니다.
          </p>
        </div>

        {/* 소셜 로그인 버튼들 */}
        <div className="px-6 py-5 space-y-2">
          <SocialLoginButton
            provider="google"
            onClick={() => handleSocialLogin("google")}
            disabled={isLoading}
          />
          <SocialLoginButton
            provider="kakao"
            onClick={() => handleSocialLogin("kakao")}
            disabled={isLoading}
          />
          <SocialLoginButton
            provider="naver"
            onClick={() => handleSocialLogin("naver")}
            disabled={isLoading}
          />
        </div>

        {/* 구분선 */}
        <div className="relative px-6">
          <div className="absolute inset-0 flex items-center px-6">
            <div className="w-full border-t border-neutral-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white text-neutral-500">또는</span>
          </div>
        </div>

        {/* 이메일 로그인 */}
        <div className="px-6 py-5">
          <input
            type="email"
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleEmailContinue();
              }
            }}
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          />
          <button
            onClick={handleEmailContinue}
            disabled={isLoading}
            className="w-full mt-3 px-4 py-2.5 bg-black text-white rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "확인 중..." : "계속"}
          </button>
        </div>

        {/* 약관 안내 */}
        <div className="px-6 pb-6">
          <p className="text-xs text-neutral-500 text-center leading-relaxed">
            계속 진행하면 집체크의{" "}
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
    </>
  );
}
