"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, Settings, LogOut, Crown, ChevronDown, LogIn } from "lucide-react";
import LoginModal from "@/components/auth/LoginModal";

interface UserProfileNewProps {
  isExpanded: boolean;
}

export default function UserProfileNew({ isExpanded }: UserProfileNewProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // TODO: 백엔드 담당자가 실제 세션 상태로 교체할 부분
  // const { data: session, status } = useSession();
  // const isLoggedIn = status === "authenticated";

  // 임시 로그인 상태 (테스트용)
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Mock user data (로그인 시)
  const user = {
    name: "홍길동",
    email: "hong@example.com",
    plan: "무료",
    image: null, // 프로필 이미지 URL
  };

  const handleLogout = () => {
    // TODO: 백엔드 담당자가 연결할 로그아웃 로직
    // signOut({ callbackUrl: "/" });
    console.log("로그아웃");
    setIsLoggedIn(false);
    setIsDropdownOpen(false);
  };

  // 로그인하지 않은 상태
  if (!isLoggedIn) {
    return (
      <>
        <button
          onClick={() => setIsLoginModalOpen(true)}
          className={`w-full flex items-center ${
            isExpanded ? "gap-3 justify-start" : "justify-center"
          } p-3 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 rounded-xl transition-all duration-200 group`}
        >
          <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center shrink-0 group-hover:from-red-200 group-hover:to-pink-200 transition-colors">
            <LogIn className="w-5 h-5 text-red-600" />
          </div>

          {isExpanded && (
            <div className="flex-1 text-left">
              <div className="font-medium text-sm text-neutral-800 group-hover:text-red-600 transition-colors">
                로그인
              </div>
              <p className="text-xs text-neutral-500">서비스를 시작하세요</p>
            </div>
          )}
        </button>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />
      </>
    );
  }

  // 로그인한 상태
  return (
    <div className="relative">
      {/* User Info Block */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={`w-full flex items-center ${
          isExpanded ? "gap-3" : "justify-center"
        } p-3 hover:bg-neutral-100 rounded-xl transition-colors`}
      >
        {/* 프로필 이미지 또는 아바타 */}
        <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-pink-400 rounded-full flex items-center justify-center shrink-0 text-white font-semibold">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-sm">{user.name.charAt(0)}</span>
          )}
        </div>

        {isExpanded && (
          <>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{user.name}</span>
                <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                  {user.plan}
                </span>
              </div>
              <p className="text-xs text-neutral-500 text-ellipsis-1">
                {user.email}
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-neutral-400 transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />

          {/* Menu */}
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-neutral-200 z-50 animate-slideUp">
            {/* Menu Items */}
            <div className="py-2">
              <Link
                href="/settings"
                className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-neutral-50 transition-colors"
                onClick={() => setIsDropdownOpen(false)}
              >
                <Settings className="w-4 h-4 text-neutral-600" />
                <span>설정</span>
              </Link>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-neutral-50 transition-colors text-left"
              >
                <LogOut className="w-4 h-4 text-neutral-600" />
                <span>로그아웃</span>
              </button>
            </div>

            {/* Upgrade Button */}
            <div className="p-4 border-t border-neutral-100">
              <Link
                href="/pricing"
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition-all duration-200 hover:shadow-md"
                onClick={() => setIsDropdownOpen(false)}
              >
                <Crown className="w-4 h-4" />
                <span className="font-medium">플랜 업그레이드</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
