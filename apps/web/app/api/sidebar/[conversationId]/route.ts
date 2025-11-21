import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * DELETE /api/sidebar/[conversationId]
 *
 * 대화 삭제 (소프트 삭제 - is_archived = true)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const { conversationId } = await params;

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

    console.log(`[DELETE /api/sidebar/${conversationId}] userId=${userId}`);

    // 소프트 삭제: is_archived = true 설정
    const { data, error } = await supabase
      .from('conversations')
      .update({
        is_archived: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .eq('user_id', userId)  // RLS: 본인 대화만 삭제 가능
      .select();

    if (error) {
      console.error(`[DELETE /api/sidebar/${conversationId}] 삭제 실패:`, error);
      throw error;
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: '대화를 찾을 수 없거나 삭제 권한이 없습니다' },
        { status: 404 }
      );
    }

    console.log(`[DELETE /api/sidebar/${conversationId}] ✅ 삭제 완료`);

    return NextResponse.json({
      success: true,
      message: '대화가 삭제되었습니다',
    });

  } catch (error) {
    console.error('[DELETE /api/sidebar] 오류:', error);

    return NextResponse.json(
      {
        error: '대화 삭제 실패',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
