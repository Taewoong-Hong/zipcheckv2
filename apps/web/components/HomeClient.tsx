"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import ChatInterface from "@/components/chat/ChatInterface";
import LoginModal from "@/components/auth/LoginModal";
import { useAuth } from "@/contexts/AuthContext";

export default function HomeClient() {
  const router = useRouter();

  // ✅ AuthProvider에서 인증 상태 가져오기
  const { session, isLoading, isLoggedIn } = useAuth();

  // 디버깅: 인증 상태 변화 추적
  useEffect(() => {
    console.log("[HomeClient] useAuth 상태 업데이트:", {
      isLoading,
      isLoggedIn,
      email: session?.user?.email || "없음"
    });
  }, [isLoading, isLoggedIn, session]);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);

  // SSR과 CSR 모두에서 일관된 초기값 사용
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Hydration 완료 표시
    setIsHydrated(true);

    // URL 쿼리 파라미터 확인 (?login=true) - window.location 사용
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const loginParam = urlParams.get('login');
      if (loginParam === 'true') {
        setIsLoginModalOpen(true);
        // URL에서 쿼리 파라미터 제거
        window.history.replaceState({}, '', '/');
      }
    }

    // 모바일/태블릿 화면이면 사이드바 접기
    if (window.innerWidth < 1024) {
      setIsSidebarExpanded(false);
    }

    // 리사이즈 이벤트 처리
    const handleResize = () => {
      setIsSidebarExpanded(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Hydration 전에는 로딩 표시 (SSR/CSR 불일치 방지)
  if (!isHydrated || isLoading) {
    return (
      <div className="flex h-screen bg-neutral-50 items-center justify-center" suppressHydrationWarning>
        <div className="text-center" suppressHydrationWarning>
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" suppressHydrationWarning />
          <p className="mt-4 text-sm text-gray-600" suppressHydrationWarning>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-50" suppressHydrationWarning>
      {/* 로그인 상태일 때만 사이드바 표시 */}
      {isLoggedIn && (
        <Sidebar isExpanded={isSidebarExpanded} setIsExpanded={setIsSidebarExpanded} />
      )}

      {/* 비로그인 상태일 때 헤더 표시 */}
      {!isLoggedIn && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200" suppressHydrationWarning>
          <div className="flex items-center justify-between h-14 md:h-16 px-4 md:px-6">
            {/* 좌측 로고 */}
            <div className="flex items-center gap-1.5 md:gap-2">
              <img
                src="/logo-black.png"
                alt="집체크"
                className="h-6 md:h-8 w-auto"
              />
              <span className="text-base md:text-lg font-bold text-gray-900">집체크</span>
            </div>

            {/* 우측 네비게이션 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                로그인
              </button>

              {/* 물음표 버튼 */}
              <div className="relative">
                <button
                  onClick={() => setIsHelpMenuOpen(!isHelpMenuOpen)}
                  className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-neutral-300 hover:bg-neutral-50 transition-colors"
                  aria-label="도움말 메뉴"
                >
                  <span className="text-neutral-700 text-xs md:text-sm font-medium">?</span>
                </button>

                {/* 드롭다운 메뉴 */}
                {isHelpMenuOpen && (
                  <>
                    {/* 배경 오버레이 */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsHelpMenuOpen(false)}
                    />

                    {/* 메뉴 컨텐츠 */}
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-neutral-200 py-2 z-50 animate-slideDown">
                      <button
                        onClick={() => {
                          setIsHelpMenuOpen(false);
                          router.push('/pricing');
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-neutral-50 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <circle cx="12" cy="12" r="9" strokeWidth="2" />
                          <path strokeWidth="2" d="M12 8v4m0 4h.01" strokeLinecap="round" />
                        </svg>
                        <span>플랜 및 가격 보기</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsHelpMenuOpen(false);
                          router.push('/faq');
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-neutral-50 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>도움말 센터</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsHelpMenuOpen(false);
                          router.push('/terms?tab=terms');
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-neutral-50 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>이용약관</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsHelpMenuOpen(false);
                          router.push('/terms?tab=privacy');
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-neutral-50 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>개인정보 보호 정책</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsHelpMenuOpen(false);
                          router.push('/company');
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-neutral-50 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>회사소개</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main
        className={`flex-1 sidebar-transition ${
          isLoggedIn
            ? (isSidebarExpanded ? "lg:ml-72" : "lg:ml-20")
            : "pt-14 md:pt-16"
        }`}
      >
        <ChatInterface
          isSidebarExpanded={isSidebarExpanded}
          onToggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)}
          isLoggedIn={isLoggedIn}
          session={session}
          onLoginRequired={() => setIsLoginModalOpen(true)}
        />
      </main>

      {/* 로그인 모달 */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
}
