"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import ChatInterface from "@/components/chat/ChatInterface";
import LoginModal from "@/components/auth/LoginModal";

export default function HomePage() {
  const router = useRouter();

  // TODO: 백엔드 담당자가 실제 세션 상태로 교체할 부분
  // const { data: session, status } = useSession();
  // const isLoggedIn = status === "authenticated";

  // 임시 로그인 상태 (테스트용 - false로 설정하면 비로그인, true로 설정하면 로그인)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);

  // SSR과 CSR 모두에서 일관된 초기값 사용 (서버에서는 항상 true)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Hydration 완료 표시
    setIsHydrated(true);

    // 모바일/태블릿 화면이면 사이드바 접기
    if (window.innerWidth < 1024) {
      setIsSidebarExpanded(false);
    }

    // 리사이즈 이벤트 처리
    const handleResize = () => {
      setIsSidebarExpanded(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* 로그인 상태일 때만 사이드바 표시 */}
      {isLoggedIn && (
        <Sidebar isExpanded={isSidebarExpanded} setIsExpanded={setIsSidebarExpanded} />
      )}

      {/* 비로그인 상태일 때 헤더 표시 */}
      {!isLoggedIn && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
          <div className="flex items-center justify-between h-16 px-6">
            {/* 좌측 로고 */}
            <div className="flex items-center gap-2">
              <img
                src="/logo-black.png"
                alt="집체크"
                className="h-8 w-auto"
              />
              <span className="text-xl font-bold text-gray-900">집체크</span>
            </div>

            {/* 우측 네비게이션 */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                로그인
              </button>
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-4 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                무료로 회원 가입
              </button>

              {/* 물음표 버튼 */}
              <div className="relative">
                <button
                  onClick={() => setIsHelpMenuOpen(!isHelpMenuOpen)}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-neutral-300 hover:bg-neutral-50 transition-colors"
                  aria-label="도움말 메뉴"
                >
                  <span className="text-neutral-700 text-sm font-medium">?</span>
                </button>

                {/* 드롭다운 메뉴 */}
                {isHelpMenuOpen && (
                  <>
                    {/* 배경 오버레이 (메뉴 외부 클릭 시 닫기) */}
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
                          // TODO: 설정 페이지 구현 필요
                          console.log('설정 기능 준비중');
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-neutral-50 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
                          <path strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>설정</span>
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
                          router.push('/company');
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-neutral-50 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>릴리즈 노트</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsHelpMenuOpen(false);
                          router.push('/terms');
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-neutral-50 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>이용약관 및 정책</span>
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
            : "pt-16" // 비로그인일 때 헤더 높이만큼 padding
        }`}
      >
        <ChatInterface
          isSidebarExpanded={isSidebarExpanded}
          onToggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)}
          isLoggedIn={isLoggedIn}
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