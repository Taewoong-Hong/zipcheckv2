"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import SocialLoginButton from "./SocialLoginButton";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSocialLogin = async (provider: "kakao" | "google" | "naver") => {
    setIsLoading(true);
    console.log(`${provider} 로그인 시도`);

    try {
      if (provider === "google") {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });

        if (error) {
          console.error("Google 로그인 오류:", error);
          alert(`로그인 실패: ${error.message}`);
        }
      } else if (provider === "kakao") {
        // Supabase Kakao OAuth
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "kakao",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          console.error("Kakao 로그인 오류:", error);
          alert(`로그인 실패: ${error.message}`);
        }
      } else if (provider === "naver") {
        // Naver OAuth (커스텀 구현)
        // Generate CSRF token
        const state = Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem("naver_oauth_state", state);

        // Build Naver OAuth URL
        const naverClientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
        const redirectUri = `${window.location.origin}/auth/naver/callback`;
        const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${naverClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

        // Redirect to Naver login
        window.location.href = naverAuthUrl;
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

      {/* 모달 컨텐츠 - 컴팩트한 ChatGPT 스타일 */}
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
            더 스마트한 홈딜, 파일 및 이미지 업로드를 이용할 수 있습니다.
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
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          />
          <button
            onClick={() => {
              // TODO: 이메일 로그인 로직
              console.log("이메일 로그인");
            }}
            className="w-full mt-3 px-4 py-2.5 bg-black text-white rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            계속
          </button>
        </div>

        {/* 이용약관 */}
        <div className="px-6 pb-6 text-center text-xs text-neutral-500 leading-relaxed">
          ChatGPT의 메시지를 보내므로써, 당사의{" "}
          <Link
            href="/terms"
            className="text-neutral-700 hover:text-neutral-900 underline underline-offset-2"
          >
            이용약관
          </Link>
          과{" "}
          <Link
            href="/terms"
            className="text-neutral-700 hover:text-neutral-900 underline underline-offset-2"
          >
            개인정보 보호 정책
          </Link>
          에 대해 알고 있으며 이에 따라 계속 진행합니다.
        </div>
      </div>
    </div>
  );
}
