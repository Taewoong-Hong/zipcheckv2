import { NextRequest, NextResponse } from 'next/server';

const AI_API_URL = process.env.AI_API_URL || 'https://zipcheck-ai-871793445649.asia-northeast3.run.app';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversation_id: string }> }
) {
  const { conversation_id } = await params;
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // FastAPI /chat/messages/{conversation_id} 호출
    const response = await fetch(
      `${AI_API_URL}/chat/messages/${conversation_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`메시지 조회 실패: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Chat messages error:', error);
    return NextResponse.json(
      {
        error: '메시지 조회 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
