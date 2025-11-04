// Supabase Edge Function: Naver OAuth Integration
// Deno Deploy/Edge runtime (Supabase Edge Functions)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

const {
  NAVER_CLIENT_ID,
  NAVER_CLIENT_SECRET,
  NAVER_REDIRECT_URI,
  FRONT_URL, // 프론트엔드 도메인 (예: https://zipcheck.kr)
} = Deno.env.toObject();

// CLI로 배포 가능한 환경 변수 이름 사용 (SUPABASE_ 접두사 회피)
const SUPABASE_URL = Deno.env.get("PUBLIC_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function redirect(url: string, setCookies?: string | string[]) {
  const headers = new Headers({ Location: url });
  if (Array.isArray(setCookies)) {
    for (const c of setCookies) headers.append("Set-Cookie", c);
  } else if (setCookies) {
    headers.append("Set-Cookie", setCookies);
  }
  return new Response(null, { status: 302, headers });
}

function asJSON(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function buildAuthorizeURL(state: string) {
  const auth = new URL("https://nid.naver.com/oauth2.0/authorize");
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", NAVER_CLIENT_ID!);
  auth.searchParams.set("redirect_uri", NAVER_REDIRECT_URI!);
  auth.searchParams.set("state", state);
  return auth.toString();
}

async function exchangeCodeForToken(code: string, state: string) {
  const tokenURL = new URL("https://nid.naver.com/oauth2.0/token");
  tokenURL.searchParams.set("grant_type", "authorization_code");
  tokenURL.searchParams.set("client_id", NAVER_CLIENT_ID!);
  tokenURL.searchParams.set("client_secret", NAVER_CLIENT_SECRET!);
  tokenURL.searchParams.set("code", code);
  tokenURL.searchParams.set("state", state);
  const res = await fetch(tokenURL, { method: "GET" });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: string;
  }>;
}

async function fetchNaverProfile(accessToken: string) {
  const res = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  const body = await res.json() as {
    resultcode: string;
    message: string;
    response: {
      id: string;
      email?: string;
      name?: string;
      profile_image?: string;
      gender?: string;
      mobile?: string;
    };
  };
  return body.response;
}

// upsertSupabaseUser와 generateMagicLink 함수는 제거됨
// 콜백에서 직접 createUser + generateLink(hashed_token) 사용

// buildCookie 함수 제거: Edge Function에서 쿠키를 설정하지 않음
// 모든 세션 쿠키는 프론트엔드 /auth/callback Route Handler에서 설정

// Allowed origins for CORS and security
const ALLOWED_ORIGINS = [
  "https://zipcheck.kr",
  "https://www.zipcheck.kr",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://gsiismzchtgdklvdvggu.supabase.co",
];

const FRONTEND_ORIGIN_COOKIE = "naver_frontend_origin";

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Router
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const origin = req.headers.get("origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  // Security: Referrer/Origin validation (OAuth 엔드포인트만)
  if (pathname.includes("/authorize")) {
    const referer = req.headers.get("referer");
    const isValidOrigin = origin && ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
    const isValidReferer = referer && ALLOWED_ORIGINS.some(allowed => referer.startsWith(allowed));

    if (!isValidOrigin && !isValidReferer) {
      return asJSON({ error: "invalid_origin" }, 403);
    }
  }

  // 1) /authorize → 네이버 로그인 화면으로 보냄
  // URL: https://gsiismzchtgdklvdvggu.supabase.co/functions/v1/naver/authorize
  if (pathname === "/naver" || pathname === "/naver/authorize") {
    // CSRF 방지: state = 랜덤값(쿠키에도 저장)
    const state = crypto.randomUUID();
    const stateCookie = `naver_oauth_state=${state}; Path=/; SameSite=Lax; Max-Age=600`;

    // ✅ return_url query parameter (최우선 순위)
    const returnUrl = url.searchParams.get("return_url");

    // Capture caller frontend origin for callback redirect
    const referer = req.headers.get("referer");
    const refererOrigin = referer ? new URL(referer).origin : null;

    // 🔍 디버깅 로그 추가
    console.log("[Naver Authorize] return_url:", returnUrl);
    console.log("[Naver Authorize] referer:", referer);
    console.log("[Naver Authorize] refererOrigin:", refererOrigin);
    console.log("[Naver Authorize] origin header:", origin);
    console.log("[Naver Authorize] ALLOWED_ORIGINS:", ALLOWED_ORIGINS);

    // ✅ 우선순위: return_url > refererOrigin > origin > null
    const chosenOrigin = returnUrl && ALLOWED_ORIGINS.includes(returnUrl)
      ? returnUrl
      : (refererOrigin && ALLOWED_ORIGINS.includes(refererOrigin)
        ? refererOrigin
        : (origin && ALLOWED_ORIGINS.includes(origin) ? origin : null));

    console.log("[Naver Authorize] chosenOrigin:", chosenOrigin);

    const originCookie = chosenOrigin ? `${FRONTEND_ORIGIN_COOKIE}=${encodeURIComponent(chosenOrigin)}; Path=/; SameSite=Lax; Max-Age=600` : "";
    const cookies: string[] = originCookie ? [stateCookie, originCookie] : [stateCookie];

    console.log("[Naver Authorize] Cookies to set:", cookies);

    return redirect(buildAuthorizeURL(state), cookies);
  }

  // 2) /callback → 코드 교환, 유저 생성, JWT 발급
  // URL: https://gsiismzchtgdklvdvggu.supabase.co/functions/v1/naver/callback
  if (pathname === "/naver/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookies = req.headers.get("cookie") ?? "";
    const cookieState = cookies
      .split(";")
      .map(v => v.trim())
      .find(v => v.startsWith("naver_oauth_state="))
      ?.split("=")[1];

    // 디버깅 로그
    console.log("[Naver Callback] code:", code?.substring(0, 10));
    console.log("[Naver Callback] state:", state);
    console.log("[Naver Callback] cookies:", cookies);
    console.log("[Naver Callback] cookieState:", cookieState);

    if (!code || !state || state !== cookieState) {
      console.error("[Naver Callback] Validation failed", { code: !!code, state: !!state, cookieState: !!cookieState, match: state === cookieState });
      return asJSON({ error: "invalid_state_or_code", debug: { hasCode: !!code, hasState: !!state, hasCookieState: !!cookieState, stateMatch: state === cookieState } }, 400);
    }

    try {
      // 1️⃣ 네이버 OAuth: code → access_token → 프로필
      const tokenRes = await exchangeCodeForToken(code, state);
      const profile = await fetchNaverProfile(tokenRes.access_token);

      // 2️⃣ Supabase 유저 생성/업데이트
      const email = profile.email ?? `${profile.id}@naver.local`;
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          name: profile.name ?? null,
          avatar_url: profile.profile_image ?? null,
          naver_id: profile.id,
          provider: "naver",
        },
      }).catch(() => {}); // 이미 있으면 에러 무시

      // 3️⃣ Magic Link 생성 (hashed_token 방식)
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (linkErr || !linkData?.properties?.hashed_token) {
        console.error("[Naver Callback] generateLink failed:", linkErr);
        return asJSON({ error: "LINK_GEN_FAILED", detail: String(linkErr) }, 500);
      }

      console.log("[Naver Callback] hashed_token generated for:", email);

      // 4️⃣ 프론트엔드로 리디렉션 (hashed_token 전달)
      const frontendUrl = FRONT_URL || "http://localhost:3000";
      const redirectUrl = new URL("/auth/callback", frontendUrl);
      redirectUrl.searchParams.set("type", "email");
      redirectUrl.searchParams.set("token_hash", linkData.properties.hashed_token);
      redirectUrl.searchParams.set("next", "/");

      const clearOriginCookie = `${FRONTEND_ORIGIN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;

      console.log("[Naver Callback] Redirect to:", redirectUrl.toString());

      return redirect(redirectUrl.toString(), clearOriginCookie);
    } catch (e) {
      console.error("[Naver Callback] Error:", e);
      return asJSON({ error: "oauth_failed", detail: String(e) }, 500);
    }
  }

  // 핑
  if (pathname.endsWith("/health")) return asJSON({ ok: true });

  return asJSON({ error: "not_found" }, 404);
});
