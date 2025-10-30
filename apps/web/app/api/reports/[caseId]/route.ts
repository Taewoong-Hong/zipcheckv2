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

    // Call FastAPI /reports/{case_id} endpoint
    const response = await fetch(`${AI_API_URL}/reports/${caseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: '리포트를 찾을 수 없습니다' },
          { status: 404 }
        );
      }
      throw new Error(`리포트 조회 실패: ${response.status}`);
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
