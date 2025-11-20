"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1️⃣ 초기 세션 확인
    const initSession = async () => {
      console.log("[AuthProvider] 초기 세션 확인 시작");
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("[AuthProvider] 세션 조회 오류:", error.message);
      } else {
        console.log(
          "[AuthProvider] 초기 세션:",
          currentSession?.user?.email || "없음"
        );
      }

      setSession(currentSession ?? null);
      setIsLoading(false);
    };

    initSession();

    // 2️⃣ 인증 상태 변경 구독 (단일 리스너)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any, newSession: any) => {
      console.log(
        "[AuthProvider] 인증 상태 변경:",
        event,
        newSession?.user?.email || "없음"
      );

      setSession(newSession ?? null);
      console.log("[AuthProvider] ✅ setSession 호출 완료, isLoggedIn:", !!newSession);

      // ✅ 서버 컴포넌트 동기화 (Server Component 캐시 무효화)
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        console.log("[AuthProvider] 🔄 router.refresh() 호출");
        router.refresh();
      }
    });

    return () => {
      console.log("[AuthProvider] 인증 리스너 정리");
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isLoggedIn: !!session,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 인증 상태 Hook
 *
 * @example
 * const { session, isLoading, isLoggedIn } = useAuth();
 * if (isLoading) return <LoadingSpinner />;
 * if (!isLoggedIn) return <LoginButton />;
 * return <UserProfile user={session.user} />;
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
