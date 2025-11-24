"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Home, Search, Clock, FolderOpen, PenSquare, HelpCircle, ChevronDown, ChevronRight, MessageSquare, X } from "lucide-react";
import UserProfileNew from "./UserProfileNew";
import SearchModal from "../search/SearchModal";

interface SidebarProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

export default function Sidebar({ isExpanded, setIsExpanded }: SidebarProps) {
  const [recentExpanded, setRecentExpanded] = useState(true);
  const [myKnowledgeExpanded, setMyKnowledgeExpanded] = useState(true);
  const [helpExpanded, setHelpExpanded] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [myReports, setMyReports] = useState<any[]>([]);

  // Load recent sessions from backend API (단순화 - 새 /api/sidebar 사용)
  const loadRecentSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/sidebar?filter=recent');

      if (response.ok) {
        const data = await response.json();
        setRecentSessions(data.conversations || []);
      } else {
        console.error('Failed to load recent sessions:', response.status);
        setRecentSessions([]);
      }
    } catch (error) {
      console.error('Error loading recent sessions:', error);
      setRecentSessions([]);
    }
  }, []); // 의존성 없음 - 한 번만 생성

  // Load recent sessions when Recent section is expanded
  useEffect(() => {
    if (recentExpanded) {
      loadRecentSessions();
    }
  }, [recentExpanded]);

  // ✅ 폴링 제거: 무한 루프 원인 해결
  // 이전에는 2초마다 API를 호출하여 무한 루프 발생
  // 이제는 섹션 열릴 때만 1회 로드

  // Listen to auth state changes and load data when authenticated
  useEffect(() => {
    let authListener: any = null;

    const setupAuthListener = async () => {
      const { getBrowserSupabase } = await import('../../lib/supabaseBrowser');
      const supabase = getBrowserSupabase();

      // Listen to auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
        console.log('[Sidebar] Auth state changed:', event, !!session);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Wait a bit for session to be fully established
          setTimeout(() => {
            if (recentExpanded) {
              loadRecentSessions();
            }
            if (myKnowledgeExpanded) {
              loadMyReports();
            }
          }, 500);
        } else if (event === 'SIGNED_OUT') {
          setRecentSessions([]);
          setMyReports([]);
        }
      });

      authListener = subscription;

      // Also load data immediately if already authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (recentExpanded) {
          loadRecentSessions();
        }
        if (myKnowledgeExpanded) {
          loadMyReports();
        }
      }
    };

    setupAuthListener();

    return () => {
      if (authListener) {
        authListener.unsubscribe();
      }
    };
  }, [recentExpanded, myKnowledgeExpanded]);

  // Load my reports when My Knowledge section is expanded
  useEffect(() => {
    if (myKnowledgeExpanded) {
      loadMyReports();
    }
  }, [myKnowledgeExpanded]);

  // Load reports from backend (단순화 - 새 /api/sidebar 사용)
  const loadMyReports = useCallback(async () => {
    try {
      const response = await fetch('/api/sidebar?filter=report');

      if (response.ok) {
        const data = await response.json();
        setMyReports(data.conversations || []);
      } else {
        console.error('Failed to load reports:', response.status);
        setMyReports([]);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      setMyReports([]);
    }
  }, []); // 의존성 없음 - 한 번만 생성

  // Format date for display
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '';

    const now = new Date();
    const messageDate = new Date(date);

    // Invalid date check
    if (isNaN(messageDate.getTime())) return '';

    const diffInMillis = now.getTime() - messageDate.getTime();
    const diffInMinutes = Math.floor(diffInMillis / 60000);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return "방금";
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
    if (diffInHours < 24) return `${diffInHours}시간 전`;
    if (diffInDays < 7) return `${diffInDays}일 전`;
    return messageDate.toLocaleDateString('ko-KR');
  };

  // Delete conversation handler
  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent conversation click

    if (!confirm('이 대화를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sidebar/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Reload conversations after deletion
        loadRecentSessions();
        loadMyReports();
      } else {
        console.error('Failed to delete conversation:', response.status);
        alert('대화 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('대화 삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <>
      {/* Mobile/Tablet toggle button - only show when sidebar is collapsed */}
      {!isExpanded && (
        <button
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md lg:hidden cursor-e-resize"
          onClick={() => setIsExpanded(true)}
        >
          <Image
            src="/toggle.svg"
            alt="Open sidebar"
            width={20}
            height={20}
            className="rotate-180"
          />
        </button>
      )}

      {/* Overlay - 모바일/태블릿에서 사이드바가 열렸을 때만 표시 */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-white border-r border-neutral-200 sidebar-transition z-40 flex flex-col
          ${isExpanded ? "w-64 overflow-x-hidden" : "w-20 overflow-visible"}
          ${isExpanded ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo Section */}
        <div className={`p-5 border-b border-neutral-200 ${!isExpanded ? 'group/logo' : ''}`}>
          <div className={`flex items-center ${isExpanded ? 'justify-between' : 'justify-center h-14'} relative`}>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`relative flex items-center gap-3 ${!isExpanded ? 'p-2 cursor-e-resize' : ''} rounded transition-all`}
              aria-label={isExpanded ? "사이드바 접기" : "사이드바 열기"}
              aria-expanded={isExpanded}
            >
              <Image
                src="/logo-black.png"
                alt="ZipCheck"
                width={isExpanded ? 32 : 24}
                height={isExpanded ? 32 : 24} 
                className={`shrink-0 ${!isExpanded ? 'group-hover/logo:opacity-0' : ''} transition-opacity`}
              />
              {!isExpanded && (
                <Image
                  src="/toggle.svg"
                  alt="Open sidebar"
                  width={22}
                  height={22}
                  className="opacity-0 group-hover/logo:opacity-100 rotate-180 transition-all absolute inset-0 m-auto"
                />
              )}
              {isExpanded && <span className="font-bold text-base">집체크</span>}
            </button>
            {!isExpanded && (
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/logo:opacity-100 transition-opacity z-50">
                사이드바 열기
              </div>
            )}
            {isExpanded && (
              <button
                className="p-2 rounded hover:bg-neutral-100 transition-colors cursor-w-resize"
                onClick={() => setIsExpanded(false)}
              >
                <Image
                  src="/toggle.svg"
                  alt="Toggle sidebar"
                  width={20}
                  height={20}
                  className="transition-transform"
                />
              </button>
            )}
          </div>
        </div>

        {/* New Contract Button */}
        <div className="p-4">
          <div className="relative group">
            <button
              onClick={() => {
                if (typeof (window as any).resetChat === 'function') {
                  (window as any).resetChat();
                }
              }}
              className={`w-full flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-xl bg-brand-primary text-white hover:bg-brand-secondary transition-colors`}>
              <PenSquare className="w-5 h-5 shrink-0" />
              {isExpanded && <span className="text-sm font-medium">새 채팅</span>}
            </button>
            {!isExpanded && (
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[100]">
                새 채팅
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <nav className={`flex-1 relative ${isExpanded ? 'overflow-y-auto' : ''}`}>
          <div className="px-4 py-2">
            <div className="relative group">
              <button
                onClick={() => {
                  // Reset to home view without saving
                  if (typeof (window as any).resetChat === 'function') {
                    (window as any).resetChat();
                  }
                }}
                className={`w-full flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-xl hover:bg-neutral-100 transition-colors`}>
                <Home className="w-5 h-5 shrink-0 text-neutral-600" />
                {isExpanded && <span className="text-sm text-left">홈</span>}
              </button>
              {!isExpanded && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[100]">
                  홈
                </div>
              )}
            </div>
            
            <div className="relative group">
              <button
                onClick={() => setIsSearchOpen(true)}
                className={`w-full flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-xl hover:bg-neutral-100 transition-colors`}
              >
                <Search className="w-5 h-5 shrink-0 text-neutral-600" />
                {isExpanded && <span className="text-sm text-left">검색</span>}
              </button>
              {!isExpanded && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[100]">
                  채팅 검색
                </div>
              )}
            </div>

            {/* Recent Section */}
            <div className="relative group">
              <button
                className={`w-full flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-xl hover:bg-neutral-100 transition-colors`}
                onClick={() => {
                  if (!isExpanded) {
                    setIsExpanded(true);
                    setRecentExpanded(true);
                  } else {
                    setRecentExpanded(!recentExpanded);
                  }
                }}
              >
                <Clock className="w-5 h-5 shrink-0 text-neutral-600" />
                {isExpanded && (
                  <>
                    <span className="flex-1 text-left text-sm">최근</span>
                    {recentExpanded ? (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                    )}
                  </>
                )}
              </button>
              {!isExpanded && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[100]">
                  최근
                </div>
              )}
            </div>

            {isExpanded && recentExpanded && (
              <div className="ml-8 mt-1 space-y-1">
                {recentSessions.length > 0 ? (
                  recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors group relative"
                    >
                      <button
                        onClick={() => {
                          if (typeof (window as any).loadChatSession === 'function') {
                            (window as any).loadChatSession(session.id);
                          }
                        }}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <MessageSquare className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span className="flex-1 text-sm truncate">{session.title}</span>
                      </button>
                      <button
                        onClick={(e) => handleDeleteConversation(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-neutral-200 rounded transition-all"
                        title="삭제"
                      >
                        <X className="w-3 h-3 text-neutral-500" />
                      </button>
                      <span className="text-xs text-neutral-400 opacity-0 group-hover:opacity-100">
                        {formatDate(session.updatedAt)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-neutral-500">
                    최근 대화가 없습니다
                  </div>
                )}
              </div>
            )}

            {/* My Knowledge Section */}
            <div className="relative group">
              <button
                className={`w-full flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-xl hover:bg-neutral-100 transition-colors mt-4`}
                onClick={() => {
                  if (!isExpanded) {
                    setIsExpanded(true);
                    setMyKnowledgeExpanded(true);
                  } else {
                    setMyKnowledgeExpanded(!myKnowledgeExpanded);
                  }
                }}
              >
                <FolderOpen className="w-5 h-5 shrink-0 text-neutral-600" />
                {isExpanded && (
                  <>
                    <span className="flex-1 text-left text-sm">내 분석</span>
                    {myKnowledgeExpanded ? (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                    )}
                  </>
                )}
              </button>
              {!isExpanded && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[100]">
                  내 분석
                </div>
              )}
            </div>

            {isExpanded && myKnowledgeExpanded && (
              <div className="ml-8 mt-1 space-y-1">
                {myReports.length > 0 ? (
                  myReports.map((report) => (
                    <div
                      key={report.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors group relative"
                    >
                      <button
                        onClick={() => {
                          // case_id가 있으면 리포트로, 없으면 대화로
                          if (report.case_id) {
                            window.location.href = `/report/${report.case_id}`;
                          } else if (typeof (window as any).loadChatSession === 'function') {
                            (window as any).loadChatSession(report.id);
                          }
                        }}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <FolderOpen className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span className="flex-1 text-sm truncate">
                          {report.property_address || report.title || '분석 대화'}
                        </span>
                      </button>
                      <button
                        onClick={(e) => handleDeleteConversation(report.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-neutral-200 rounded transition-all"
                        title="삭제"
                      >
                        <X className="w-3 h-3 text-neutral-500" />
                      </button>
                      <span className="text-xs text-neutral-400 opacity-0 group-hover:opacity-100">
                        {formatDate(new Date(report.updated_at))}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-neutral-500">
                    저장된 분석이 없습니다
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Help Section */}
        <div className="p-3 border-t border-neutral-200">
          <div className="relative group">
            <button
              onClick={() => setHelpExpanded(!helpExpanded)}
              className={`w-full flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-xl hover:bg-neutral-100 transition-colors`}
            >
              <HelpCircle className="w-5 h-5 shrink-0 text-neutral-600" />
              {isExpanded && <span className="text-sm">고객지원</span>}
            </button>
            {!isExpanded && (
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[100]">
                고객지원
              </div>
            )}
          </div>

          {/* Dropdown Menu */}
          {isExpanded && helpExpanded && (
            <div className="mt-2 ml-8 space-y-1">
              <Link href="/faq" className="block w-full text-left px-4 py-2 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                FAQ
              </Link>
              <Link href="/terms" className="block w-full text-left px-4 py-2 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                이용약관 & 개인정보처리방침
              </Link>
              <Link href="/company" className="block w-full text-left px-4 py-2 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                회사소개
              </Link>
            </div>
          )}
        </div>
        
        {/* User Profile - Always at bottom */}
        <div className="border-t border-neutral-200">
          <UserProfileNew isExpanded={isExpanded} />
        </div>
      </aside>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
