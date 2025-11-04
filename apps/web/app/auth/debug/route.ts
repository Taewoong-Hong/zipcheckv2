// apps/web/app/auth/debug/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const jar = await cookies();
  const url = new URL(req.url);

  // 모든 쿠키 목록
  const allCookies = jar.getAll().map(c => ({
    name: c.name,
    valuePreview: c.value.slice(0, 30) + "...",
    length: c.value.length,
    hasValue: !!c.value
  }));

  // Supabase 클라이언트 생성 (chunked 쿠키 자동 결합)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return jar.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  // 세션 확인
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  const hasSession = !!sessionData?.session;
  const user = sessionData?.session?.user;

  return NextResponse.json({
    // 세션 상태
    hasSession,
    sessionError: sessionError?.message || null,
    user: user ? {
      id: user.id,
      email: user.email,
      provider: user.app_metadata?.provider,
    } : null,

    // 쿠키 상태
    cookies: {
      allCookies,
      cookieCount: allCookies.length,
      supabaseCookies: allCookies.filter(c => c.name.startsWith('sb-')),
    },

    // 메타 정보
    timestamp: new Date().toISOString(),
    origin: url.origin,
  });
}
