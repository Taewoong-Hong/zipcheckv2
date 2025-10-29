import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Google Cloud Run AI 서비스 URL
const AI_API_URL = process.env.AI_API_URL || 'https://zipcheck-ai-ov5n6pt46a-du.a.run.app';

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, content, session } = body;

    // 인증 확인
    if (!session?.access_token) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 1. 사용자 메시지 저장 (FastAPI /chat/message 호출)
    const saveResponse = await fetch(`${AI_API_URL}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        conversation_id,
        content,
      }),
    });

    if (!saveResponse.ok) {
      throw new Error(`메시지 저장 실패: ${saveResponse.status}`);
    }

    const saveResult = await saveResponse.json();
    console.log('메시지 저장 완료:', saveResult);

    // 2. LLM 분석 (기존 /analyze 엔드포인트)
    const analyzeResponse = await fetch(`${AI_API_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: content,
      }),
    });

    if (!analyzeResponse.ok) {
      throw new Error(`분석 실패: ${analyzeResponse.status}`);
    }

    const analyzeData = await analyzeResponse.json();
    const answer = analyzeData.answer || '응답을 생성할 수 없습니다.';

    // 3. AI 응답 메시지 저장
    await supabase.from('messages').insert({
      conversation_id,
      role: 'assistant',
      content: answer,
      topic: 'contract_analysis',
      extension: 'chat',
    });

    // 4. 스트리밍 응답 반환
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const chunks = answer.split(' ');
        chunks.forEach((chunk: string, index: number) => {
          setTimeout(() => {
            const content = index === 0 ? chunk : ' ' + chunk;
            const data = JSON.stringify({ content, done: false });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));

            if (index === chunks.length - 1) {
              setTimeout(() => {
                const doneData = JSON.stringify({ done: true });
                controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
                controller.close();
              }, 50);
            }
          }, index * 50);
        });
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);

    return NextResponse.json(
      {
        error: '채팅 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  try {
    // Backend health check
    const response = await fetch(`${AI_API_URL}/health`, {
      method: 'GET',
    });

    if (response.ok) {
      return NextResponse.json({
        status: 'healthy',
        backend: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        status: 'unhealthy',
        backend: 'disconnected',
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      backend: 'unreachable',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}