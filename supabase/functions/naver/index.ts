// Supabase Edge Function: Naver OAuth Integration
// Deno Deploy/Edge runtime (Supabase Edge Functions)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";
import * as jose from "https://esm.sh/jose@5.1.3";

const {
  NAVER_CLIENT_ID,
  NAVER_CLIENT_SECRET,
  NAVER_REDIRECT_URI,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET,
  COOKIE_DOMAIN,
} = Deno.env.toObject();

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
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

/**
 * Admin upsert user in Supabase Auth.
 * - If user with email exists: reuse it
 * - If no email from Naver: synthesize pseudo email (id@naver.local) and mark as "email_confirmed"
 */
async function upsertSupabaseUser(profile: {
  id: string; email?: string; name?: string; profile_image?: string;
}) {
  const email = profile.email ?? `${profile.id}@naver.local`;
  // find existing by email
  const { data: existing, error: findErr } = await supabaseAdmin.auth.admin.listUsers();
  if (findErr) throw findErr;

  const user = existing?.users?.find(u => u.email === email);
  if (user) {
    // Update metadata if needed
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        name: profile.name ?? user.user_metadata?.name,
        avatar_url: profile.profile_image ?? user.user_metadata?.avatar_url,
        naver_id: profile.id,
      },
      app_metadata: { provider: "naver" },
    });
    return user.id;
  } else {
    // Create new user as confirmed
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        name: profile.name ?? null,
        avatar_url: profile.profile_image ?? null,
        naver_id: profile.id,
      },
      app_metadata: { provider: "naver" },
    });
    if (createErr || !created?.user) throw createErr ?? new Error("user create failed");
    return created.user.id;
  }
}

/** Mint Supabase-compatible JWT so RLS treats user as `authenticated`. */
async function mintSupabaseJWT(userId: string, expiresInSec = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    role: "authenticated",
    email_confirmed: true,
    app_metadata: { provider: "naver" },
  };
  const secret = new TextEncoder().encode(JWT_SECRET!);
  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSec)
    .setAudience("authenticated")
    .setIssuer("edge:naver")
    .sign(secret);
  return token;
}

function buildCookie(name: string, value: string) {
  const attrs = [
    `Path=/`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,  // OAuth 콜백을 위해 Lax 사용 (크로스사이트 GET 허용)
    // Domain 속성 제거: supabase.co에서 쿠키 설정 시 브라우저 차단 방지
    `Max-Age=3600`,
  ].filter(Boolean).join("; ");
  return `${name}=${value}; ${attrs}`;
}

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
    const stateCookie = buildCookie("naver_oauth_state", state);

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

    const originCookie = chosenOrigin ? buildCookie(FRONTEND_ORIGIN_COOKIE, encodeURIComponent(chosenOrigin)) : "";
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
      const tokenRes = await exchangeCodeForToken(code, state);
      const profile = await fetchNaverProfile(tokenRes.access_token);
      const userId = await upsertSupabaseUser(profile);
      const jwt = await mintSupabaseJWT(userId);

      // HttpOnly 쿠키에 저장
      const sbCookie = buildCookie("sb-access-token", jwt);

      // 성공 후 프론트로 리디렉션 (기존 /auth/callback 페이지 활용)
      const storedOrigin = cookies
        .split(";")
        .map(v => v.trim())
        .find(v => v.startsWith(`${FRONTEND_ORIGIN_COOKIE}=`))
        ?.split("=")[1];
      const decodedStored = storedOrigin ? decodeURIComponent(storedOrigin) : null;

      // 🔍 디버깅 로그 추가
      console.log("[Naver Callback] storedOrigin:", storedOrigin);
      console.log("[Naver Callback] decodedStored:", decodedStored);
      console.log("[Naver Callback] origin header:", origin);

      const frontendUrl = decodedStored && ALLOWED_ORIGINS.includes(decodedStored)
        ? decodedStored
        : (origin && ALLOWED_ORIGINS.includes(origin) ? origin : "https://zipcheck.kr");

      console.log("[Naver Callback] Final frontendUrl:", frontendUrl);

      const next = new URL("/auth/callback", frontendUrl);
      next.searchParams.set("naver_token", jwt);
      const clearOriginCookie = `${FRONTEND_ORIGIN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;

      console.log("[Naver Callback] Redirect to:", next.toString());

      return redirect(next.toString(), [sbCookie, clearOriginCookie]);
    } catch (e) {
      console.error(e);
      return asJSON({ error: "oauth_failed", detail: String(e) }, 500);
    }
  }

  // 핑
  if (pathname.endsWith("/health")) return asJSON({ ok: true });

  return asJSON({ error: "not_found" }, 404);
});
