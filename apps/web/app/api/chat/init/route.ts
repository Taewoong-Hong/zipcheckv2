import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const AI_API_URL = process.env.AI_API_URL || 'https://zipcheck-ai-871793445649.asia-northeast3.run.app';

export async function POST(request: NextRequest) {
  try {
    // Supabase 서버 클라이언트 생성 (cookies 사용)
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
              // Server component에서 set이 안 될 수 있음
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // Server component에서 remove가 안 될 수 있음
            }
          },
        },
      }
    );

    // 세션 가져오기
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      console.error('Session error:', sessionError);
      return NextResponse.json(
        { error: 'NO_SESSION', message: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    console.log('Session found, calling FastAPI with token...');

    // FastAPI /chat/init 호출
    const response = await fetch(`${AI_API_URL}/chat/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (response.status === 401) {
      console.error('FastAPI returned 401 - token invalid');
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: '인증 토큰이 유효하지 않습니다' },
        { status: 401 }
      );
    }

    if (!response.ok) {
      console.error(`FastAPI error: ${response.status}`);
      const errorData = await response.json().catch(() => ({}));
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
    console.log('Chat init successful:', data.conversation_id);

    // 성공 응답 (쿠키는 FastAPI에서 관리하지 않음, localStorage 사용)
    return NextResponse.json(data);

  } catch (error) {
    console.error('Chat init error:', error);
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
