import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
const AI_API_URL = process.env.AI_API_URL;

export async function POST(request: NextRequest) {
  try {
    console.log('[chat/init] Starting request processing');
    console.log('[chat/init] AI_API_URL:', AI_API_URL);
    if (!AI_API_URL) {
      return NextResponse.json(
        { error: 'CONFIG_MISSING', message: 'AI_API_URL 환경변수가 설정되어 있지 않습니다' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              console.warn(`[chat/init] Cookie set failed for ${name}:`, error);
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              console.warn(`[chat/init] Cookie remove failed for ${name}:`, error);
            }
          },
        },
      }
    );

    // Resolve access token: Authorization header -> Supabase session -> Cookie -> JSON body session
    let bearerToken: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      bearerToken = authHeader.slice('Bearer '.length).trim();
      console.log('[chat/init] Using token from Authorization header');
    } else {
      console.log('[chat/init] Fetching session from Supabase...');
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        bearerToken = session.access_token;
        console.log('[chat/init] Using token from Supabase session');
      } else {
        // Try well-known cookie names as fallback in dev/local
        const cookieAccess = cookieStore.get('sb-access-token')?.value
          || cookieStore.get('sb:token')?.value
          || cookieStore.get('supabase-auth-token')?.value;
        if (cookieAccess) {
          try {
            // Some cookies store JSON with access_token; handle both raw and JSON
            if (cookieAccess.startsWith('{')) {
              const parsed = JSON.parse(cookieAccess);
              bearerToken = parsed?.access_token || parsed?.currentSession?.access_token;
            } else {
              bearerToken = cookieAccess;
            }
            if (bearerToken) {
              console.log('[chat/init] Using token from cookie');
            }
          } catch (e) {
            console.warn('[chat/init] Failed parsing token cookie:', e);
          }
        }

        try {
          const body = await request.json();
          const tokenFromBody: string | undefined = body?.session?.access_token;
          if (tokenFromBody) {
            bearerToken = tokenFromBody;
            console.log('[chat/init] Using token from request body session');
          }
        } catch {
          // No JSON body or unreadable body
        }
      }
    }

    if (!bearerToken) {
      return NextResponse.json(
        { error: 'NO_SESSION', message: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    console.log('[chat/init] Auth ready, calling FastAPI...');
    console.log('[chat/init] Token preview:', bearerToken.substring(0, 20) + '...');

    // Timeout wrapper for backend call
    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 15000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(id);
      }
    };

    // Call FastAPI /chat/init
    let response: Response;
    try {
      response = await fetchWithTimeout(`${AI_API_URL}/chat/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
        },
      });
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      console.error('[chat/init] Fetch error:', err);
      return NextResponse.json(
        {
          error: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: isAbort ? '백엔드 응답이 지연되었습니다' : '백엔드 요청 중 네트워크 오류가 발생했습니다',
          details: err instanceof Error ? err.message : String(err),
        },
        { status: isAbort ? 504 : 502 }
      );
    }

    console.log('[chat/init] FastAPI response status:', response.status);

    if (response.status === 401) {
      const errorBody = await response.text().catch(() => undefined);
      console.error('[chat/init] 401 response body:', errorBody);
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: '인증 토큰이 유효하지 않습니다' },
        { status: 401 }
      );
    }

    if (response.status === 403) {
      const errorBody = await response.text().catch(() => undefined);
      console.error('[chat/init] 403 response body:', errorBody);
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '접근이 거부되었습니다' },
        { status: 403 }
      );
    }

    if (!response.ok) {
      let errorData: any = undefined;
      try {
        errorData = await response.json();
      } catch {
        const errorText = await response.text().catch(() => '');
        errorData = { message: errorText };
      }
      return NextResponse.json(
        {
          error: 'BACKEND_ERROR',
          message: '채팅 세션 생성에 실패했습니다',
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[chat/init] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'SERVER_ERROR',
        message: '채팅 세션 생성 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
