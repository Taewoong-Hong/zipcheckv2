import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const AI_API_URL = process.env.AI_API_URL;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    if (!AI_API_URL) {
      return NextResponse.json(
        { error: 'CONFIG_MISSING', message: 'AI_API_URL 환경변수가 설정되어 있지 않습니다' },
        { status: 500 }
      );
    }

    const { caseId } = await params;

    // Get user session from cookies
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 🔍 디버그 로깅
    console.log('[DEBUG] API Route - caseId:', caseId);
    console.log('[DEBUG] API Route - backendUrl:', AI_API_URL);
    console.log('[DEBUG] API Route - authHeader:', session.access_token ? 'present ✅' : 'missing ❌');
    console.log('[DEBUG] API Route - Fetching:', `${AI_API_URL}/reports/${caseId}`);

    // Call FastAPI /reports/{case_id} endpoint
    const response = await fetch(`${AI_API_URL}/reports/${caseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[DEBUG] API Route - Response status:', response.status);
    console.log('[DEBUG] API Route - Response ok:', response.ok);

    if (!response.ok) {
      const text = await response.text(); // 그냥 text로 통째로 보기
      console.error('[DEBUG] API Route - Error body:', text);

      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {}

      return NextResponse.json(
        {
          error: 'Failed to fetch report',
          detail: parsed?.detail ?? parsed ?? text,
        },
        { status: response.status }
      );
    }

    const report = await response.json();

    return NextResponse.json(report);
  } catch (error) {
    console.error('Report get error:', error);
    return NextResponse.json(
      {
        error: '리포트 조회 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
