/**
 * 공통 로딩 스피너 컴포넌트
 * 다양한 사이즈와 스타일을 지원합니다.
 */

import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: "primary" | "white" | "gray";
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-2",
  lg: "w-12 h-12 border-3",
  xl: "w-16 h-16 border-4",
};

const colorClasses = {
  primary: "border-red-600 border-t-transparent",
  white: "border-white border-t-transparent",
  gray: "border-neutral-400 border-t-transparent",
};

export default function LoadingSpinner({
  size = "md",
  color = "primary",
  text,
  fullScreen = false,
  className = "",
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} ${colorClasses[color]}`}
        role="status"
        aria-label="로딩 중"
      />
      {text && (
        <p className={`text-neutral-600 ${size === "sm" ? "text-xs" : "text-sm"}`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
}

/**
 * 페이지 전체 로딩 (페이지 전환 시 사용)
 */
export function PageLoader({ text = "로딩 중..." }: { text?: string }) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

/**
 * 인라인 로딩 (버튼, 카드 등 내부에 사용)
 */
export function InlineLoader({ text }: { text?: string }) {
  return <LoadingSpinner size="sm" text={text} />;
}

/**
 * 오버레이 로딩 (모달, 다이얼로그 등에 사용)
 */
export function OverlayLoader({ text = "처리 중..." }: { text?: string }) {
  return <LoadingSpinner size="lg" text={text} fullScreen />;
}

/**
 * 채팅 메시지 로딩 (타이핑 효과)
 */
export function ChatLoadingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-neutral-100 rounded-2xl w-fit">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></span>
      </div>
      <span className="text-sm text-neutral-600">답변 생성 중</span>
    </div>
  );
}

/**
 * 스켈레톤 로더 (콘텐츠 로딩 시 사용)
 */
export function SkeletonLoader({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-neutral-200 rounded"
          style={{ width: `${Math.random() * 30 + 70}%` }}
        />
      ))}
    </div>
  );
}

/**
 * 프로그레스 바 (업로드, 다운로드 등에 사용)
 */
export function ProgressBar({ progress = 0 }: { progress: number }) {
  return (
    <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
      <div
        className="bg-red-600 h-full transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
