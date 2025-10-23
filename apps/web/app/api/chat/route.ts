import { NextRequest, NextResponse } from 'next/server';

// Google Cloud Run에 배포된 AI 서비스 URL
const AI_API_URL = process.env.AI_API_URL || 'https://zipcheck-ai-871793445649.asia-northeast3.run.app';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Backend AI 서비스의 /analyze 엔드포인트 호출
    const response = await fetch(`${AI_API_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: body.messages[body.messages.length - 1].content, // 최신 메시지
        context: body.messages.slice(0, -1), // 이전 대화 컨텍스트 (선택적)
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    // 스트리밍 응답인지 일반 응답인지 확인
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('text/event-stream')) {
      // 스트리밍 응답 처리
      return new NextResponse(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // 일반 JSON 응답 처리
      const data = await response.json();

      // 백엔드 응답을 프론트엔드 포맷에 맞게 변환
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // 백엔드 응답을 스트리밍 형식으로 변환
          const message = data.answer || data.message || '응답을 생성할 수 없습니다.';
          const chunks = message.split(' '); // 단어별로 나누기 (더 자연스러운 스트리밍 효과)

          chunks.forEach((chunk: string, index: number) => {
            setTimeout(() => {
              const content = index === 0 ? chunk : ' ' + chunk;
              const data = JSON.stringify({ content, done: false });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));

              if (index === chunks.length - 1) {
                // 마지막 청크 후 완료 신호
                setTimeout(() => {
                  const doneData = JSON.stringify({ done: true });
                  controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
                  controller.close();
                }, 50);
              }
            }, index * 50); // 각 단어마다 50ms 딜레이
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
    }
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