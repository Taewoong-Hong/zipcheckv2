"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import ChatInterface from "@/components/chat/ChatInterface";

export default function HomePage() {
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
      <Sidebar isExpanded={isSidebarExpanded} setIsExpanded={setIsSidebarExpanded} />

      {/* Main Content - lg 이상에서만 사이드바 크기만큼 margin */}
      <main
        className={`flex-1 sidebar-transition ${
          isSidebarExpanded ? "lg:ml-72" : "lg:ml-20"
        }`}
      >
        <ChatInterface
          isSidebarExpanded={isSidebarExpanded}
          onToggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)}
        />
      </main>
    </div>
  );
}