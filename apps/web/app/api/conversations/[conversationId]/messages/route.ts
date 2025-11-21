import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/conversations/[conversationId]/messages
 *
 * 대화의 모든 메시지 조회 (시간순 정렬)
 */
export async function GET(
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

    console.log(`[GET /api/conversations/${conversationId}/messages] userId=${userId}`);

    // 1. 먼저 대화가 사용자 소유인지 확인
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, user_id, title, created_at')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .eq('is_archived', false)  // 아카이브된 대화는 제외
      .single();

    if (convError || !conversation) {
      console.error(`[GET /api/conversations/${conversationId}/messages] 대화를 찾을 수 없음:`, convError);
      return NextResponse.json(
        { error: '대화를 찾을 수 없거나 접근 권한이 없습니다' },
        { status: 404 }
      );
    }

    // 2. 대화의 모든 메시지 조회 (생성일 기준 오름차순)
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error(`[GET /api/conversations/${conversationId}/messages] 메시지 조회 실패:`, messagesError);
      throw messagesError;
    }

    console.log(`[GET /api/conversations/${conversationId}/messages] ✅ ${messages.length}개 메시지 조회 완료`);

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        created_at: conversation.created_at,
      },
      messages: messages || [],
      count: messages?.length || 0,
    });

  } catch (error) {
    console.error('[GET /api/conversations/[conversationId]/messages] 오류:', error);

    return NextResponse.json(
      {
        error: '메시지 조회 실패',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
