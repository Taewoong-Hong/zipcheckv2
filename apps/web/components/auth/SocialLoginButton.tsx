"use client";

import React from "react";

interface SocialLoginButtonProps {
  provider: "kakao" | "google" | "naver";
  onClick?: () => void;
  disabled?: boolean;
}

const providerConfig = {
  kakao: {
    name: "카카오",
    bgColor: "bg-white",
    hoverColor: "hover:bg-neutral-50",
    textColor: "text-neutral-800",
    border: "border border-neutral-300",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path fill="#000000" d="M12 3C6.477 3 2 6.477 2 10.5c0 2.568 1.933 4.823 4.8 6.2l-1.267 4.667a.5.5 0 00.734.567L11.8 18.4c.067.003.133.005.2.005 5.523 0 10-3.477 10-7.5S17.523 3 12 3z" />
      </svg>
    ),
  },
  google: {
    name: "구글",
    bgColor: "bg-white",
    hoverColor: "hover:bg-neutral-50",
    textColor: "text-neutral-800",
    border: "border border-neutral-300",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
  },
  naver: {
    name: "네이버",
    bgColor: "bg-white",
    hoverColor: "hover:bg-neutral-50",
    textColor: "text-neutral-800",
    border: "border border-neutral-300",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path fill="#03C75A" d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727z" />
      </svg>
    ),
  },
};

export default function SocialLoginButton({
  provider,
  onClick,
  disabled = false,
}: SocialLoginButtonProps) {
  const config = providerConfig[provider];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-md
        transition-all duration-200
        ${config.bgColor}
        ${config.hoverColor}
        ${config.textColor}
        ${config.border || ""}
        ${disabled ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"}
        shadow-sm
      `}
      aria-label={`${config.name}로 계속하기`}
    >
      <span className="flex items-center justify-center w-4 h-4 shrink-0">
        {config.icon}
      </span>
      <span className="text-sm font-medium">{config.name}로 계속하기</span>
    </button>
  );
}
