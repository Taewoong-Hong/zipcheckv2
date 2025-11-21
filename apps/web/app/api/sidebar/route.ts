import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/sidebar
 *
 * GPT 스타일 사이드바 데이터 조회 (기존 011 스키마 활용)
 * - filter: 'recent' | 'report' | 'all' (기본값: 'all')
 * - sidebar_conversations 뷰 사용 (RLS + v2_cases 조인)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Supabase SSR 클라이언트
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

    // 인증 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: '인증이 필요합니다', type: 'NO_SESSION' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // 'recent' | 'report' | 'all'

    console.log(`[GET /api/sidebar] userId=${userId}, filter=${filter}`);

    // sidebar_conversations 뷰 조회
    let query = supabase
      .from('sidebar_conversations')
      .select('*');

    // 필터 적용
    if (filter === 'recent') {
      query = query.eq('is_recent_conversation', true);
    } else if (filter === 'report') {
      query = query.eq('is_analysis_report', true);
    }
    // filter='all'이면 전체 조회 (뷰가 이미 is_archived=FALSE 필터링)

    const { data: conversations, error } = await query;

    if (error) {
      console.error('[GET /api/sidebar] 조회 실패:', error);
      throw error;
    }

    console.log(`[GET /api/sidebar] ✅ ${conversations?.length || 0}개 대화 조회 완료`);

    return NextResponse.json({
      conversations: conversations || [],
      total: conversations?.length || 0,
    });

  } catch (error) {
    console.error('[GET /api/sidebar] 오류:', error);

    return NextResponse.json(
      {
        error: '사이드바 조회 실패',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
