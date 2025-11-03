// apps/web/app/api/auth/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return jar.get(name)?.value;
        },
        set() {}, // 여기선 읽기만 필요
        remove() {},
      },
    }
  );

  // 1) 세션 가져오기 (쿠키에서 토큰 읽기)
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    console.log("[/api/auth/session] 세션 없음:", sessionError?.message);
    return NextResponse.json({ authenticated: false, session: null }, { status: 200 });
  }

  // 2) 서버 인증 (보안 경고 해결)
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.log("[/api/auth/session] 사용자 인증 실패:", userError?.message);
    return NextResponse.json({ authenticated: false, session: null }, { status: 200 });
  }

  console.log("[/api/auth/session] 세션 확인:", user.email);

  return NextResponse.json({
    authenticated: true,
    session: session, // 전체 세션 정보 반환
    user: user, // 서버 인증된 사용자 정보
  });
}