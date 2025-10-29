import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const AI_API_URL = process.env.AI_API_URL || 'https://zipcheck-ai-ov5n6pt46a-du.a.run.app';

export async function POST(request: NextRequest) {
  try {
    // 🔍 디버깅: 요청 정보 로깅
    console.log('[chat/init] Starting request processing');
    console.log('[chat/init] AI_API_URL:', AI_API_URL);

    // Try to read Authorization header first (preferred)
    const authHeader = request.headers.get('authorization');
    const cookieStore = await cookies();

    // 🔍 디버깅: 쿠키 정보 로깅
    const allCookies = cookieStore.getAll();
    console.log('[chat/init] Available cookies:', allCookies.map(c => c.name).join(', '));
    console.log('[chat/init] Supabase auth cookies:',
      allCookies.filter(c => c.name.includes('supabase') || c.name.includes('sb-')).map(c => c.name)
    );

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const value = cookieStore.get(name)?.value;
            if (name.includes('auth-token')) {
              console.log(`[chat/init] Cookie get: ${name} = ${value ? 'present' : 'missing'}`);
            }
            return value;
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

    // Determine token: prefer Authorization header if present
    let bearerToken: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.slice('Bearer '.length).trim();
      console.log('[chat/init] Using token from Authorization header');
    } else {
      console.log('[chat/init] Fetching session from Supabase...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      // 자세한 세션 상태 로깅
      console.log('[chat/init] Session retrieval result:', {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        hasUser: !!session?.user,
        userId: session?.user?.id || 'N/A',
        tokenLength: session?.access_token?.length || 0,
        sessionError: sessionError ? sessionError.message : 'none'
      });

      if (sessionError || !session?.access_token) {
        console.error('[chat/init] ❌ Session validation failed (no Authorization header and no Supabase session)');
        return NextResponse.json(
          { error: 'NO_SESSION', message: '로그인이 필요합니다' },
          { status: 401 }
        );
      }
      bearerToken = session.access_token;
    }

    console.log('[chat/init] ✅ Auth ready, calling FastAPI with token...');
    console.log('[chat/init] Token preview:', bearerToken?.substring(0, 20) + '...');

    // FastAPI /chat/init 호출
    const response = await fetch(`${AI_API_URL}/chat/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`,
      },
    });

    // 🔍 디버깅: FastAPI 응답 로깅
    console.log('[chat/init] FastAPI response status:', response.status);
    console.log('[chat/init] FastAPI response headers:', Object.fromEntries(response.headers.entries()));

    if (response.status === 401) {
      console.error('[chat/init] ❌ FastAPI returned 401 - token invalid');
      let errorBody;
      try {
        errorBody = await response.text();
        console.error('[chat/init] 401 response body:', errorBody);
      } catch (e) {
        console.error('[chat/init] Failed to read 401 response body:', e);
      }
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: '인증 토큰이 유효하지 않습니다' },
        { status: 401 }
      );
    }

    if (response.status === 403) {
      console.error('[chat/init] ❌ FastAPI returned 403 - forbidden');
      let errorBody;
      try {
        errorBody = await response.text();
        console.error('[chat/init] 403 response body:', errorBody);
      } catch (e) {
        console.error('[chat/init] Failed to read 403 response body:', e);
      }
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '접근이 거부되었습니다' },
        { status: 403 }
      );
    }

    if (!response.ok) {
      console.error(`[chat/init] ❌ FastAPI error: ${response.status}`);
      let errorData;
      try {
        errorData = await response.json();
        console.error('[chat/init] Error response data:', errorData);
      } catch (e) {
        const errorText = await response.text().catch(() => 'Failed to read error body');
        console.error('[chat/init] Error response text:', errorText);
        errorData = { message: errorText };
      }
      return NextResponse.json(
        {
          error: 'BACKEND_ERROR',
          message: '채팅 세션 생성에 실패했습니다',
          details: errorData
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[chat/init] ✅ Chat init successful:', {
      conversation_id: data.conversation_id,
      message_id: data.message?.id || 'N/A'
    });

    // 성공 응답 (쿠키는 FastAPI에서 관리하지 않음, localStorage 사용)
    return NextResponse.json(data);

  } catch (error) {
    console.error('[chat/init] ❌ Unexpected error:', error);
    console.error('[chat/init] Error stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json(
      {
        error: 'SERVER_ERROR',
        message: '채팅 세션 생성 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
