// apps/web/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";         // Edge 런타임 금지 (쿠키 누락 방지)
export const dynamic = "force-dynamic";  // 정적 최적화 방지
export const revalidate = 0;             // 캐시 금지

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as "email";
  const nextParam = url.searchParams.get("next") ?? "/";

  console.log("[OAuth Callback] 🔍 origin:", url.origin);
  console.log("[OAuth Callback] 🔍 token_hash:", token_hash ? `${token_hash.slice(0, 20)}...` : "null");
  console.log("[OAuth Callback] 🔍 type:", type);
  console.log("[OAuth Callback] 🔍 nextParam:", nextParam);

  if (!token_hash) {
    console.log("[OAuth Callback] ❌ token_hash 누락");
    return NextResponse.redirect(new URL("/auth/error?code=missing_token", url.origin));
  }

  // ✅ 오리진 고정: next를 항상 현재 오리진 기준으로 생성
  const origin = url.origin;
  const nextUrl = new URL(nextParam, origin);

  console.log("[OAuth Callback] 🎯 nextUrl:", nextUrl.toString());
  console.log("[OAuth Callback] 🎯 nextUrl.origin:", nextUrl.origin);

  // ⚠️ '응답'을 먼저 만들고, 여기에 쿠키를 set해야 브라우저에 내려간다.
  const res = NextResponse.redirect(nextUrl);

  // 요청에 들어온 쿠키(읽기 전용)
  const reqCookies = await nextCookies();

  // 로컬(http://localhost)에서는 Secure 쿠키가 저장되지 않으니 secure=false로 강제
  const isSecure = url.protocol === "https:";
  console.log("[OAuth Callback] 🔐 isSecure:", isSecure);

  // 환경변수로 쿠키 도메인 지정 (프로덕션에서만 사용)
  const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;
  console.log("[OAuth Callback] 🍪 COOKIE_DOMAIN:", COOKIE_DOMAIN || "undefined");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // get: 요청에서 읽기
        get(name) {
          return reqCookies.get(name)?.value;
        },
        // set/remove: 반드시 'res.cookies'에 써야 한다.
        set(name, value, options) {
          console.log(`[OAuth Callback] 🍪 Setting cookie: ${name} (${value.slice(0, 20)}...)`);
          // 기본 옵션 보정 (path/sameSite/secure/domain)
          res.cookies.set({
            name,
            value,
            ...options,
            path: options?.path ?? "/",
            sameSite: (options?.sameSite as any) ?? "lax",
            secure: typeof options?.secure === "boolean" ? options.secure : isSecure,
            domain: COOKIE_DOMAIN, // ← 프로덕션에서만 .zipcheck.ai 같은 값
          });
        },
        remove(name, options) {
          console.log(`[OAuth Callback] 🗑️ Removing cookie: ${name}`);
          res.cookies.set({
            name,
            value: "",
            ...options,
            path: options?.path ?? "/",
            sameSite: (options?.sameSite as any) ?? "lax",
            secure: typeof options?.secure === "boolean" ? options.secure : isSecure,
            domain: COOKIE_DOMAIN,
            maxAge: 0,
          });
        },
      },
    }
  );

  console.log("[OAuth Callback] 🔄 Verifying OTP...");

  // 여기서 세션을 '교환'하면 위 cookies.set이 호출되며,
  // 우리가 만든 'res' 응답에 sb-access-token/refresh-token이 실제로 박힌다.
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    console.log("[OAuth Callback] ❌ verifyOtp 실패:", error.message);
    return NextResponse.redirect(
      new URL(`/auth/error?code=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  console.log("[OAuth Callback] ✅ verifyOtp 성공, user:", data?.user?.email);

  // 세션 확인
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData?.session) {
    console.log("[OAuth Callback] ❌ Session verification failed:", sessionError?.message || "null");
    return NextResponse.redirect(
      new URL("/?error=no_session", url.origin)
    );
  }

  console.log("[OAuth Callback] ✅ Session verified:", sessionData.session.user.email);
  console.log("[OAuth Callback] 🎉 Redirecting to:", nextUrl.toString());

  return res;
}
