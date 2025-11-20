/**
 * 분석 스트리밍 API (Server-Sent Events)
 *
 * FastAPI의 /analyze/stream/{case_id} 엔드포인트로 프록시
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 쿼리 파라미터 추출
    const searchParams = request.nextUrl.searchParams;
    const caseId = searchParams.get('caseId');
    const token = searchParams.get('token');

    if (!caseId) {
      return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 401 });
    }

    // FastAPI URL
    const AI_API_URL = process.env.AI_API_URL;
    if (!AI_API_URL) {
      console.error('[stream] AI_API_URL not configured');
      return NextResponse.json({ error: 'Backend URL not configured' }, { status: 500 });
    }

    const backendUrl = `${AI_API_URL}/analyze/stream/${caseId}`;
    console.log(`[stream] Proxying to: ${backendUrl}`);

    // FastAPI로 SSE 요청
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
    });

    if (!response.ok) {
      console.error(`[stream] FastAPI error: ${response.status}`);
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Streaming failed: ${errorText}` },
        { status: response.status }
      );
    }

    // SSE 스트림을 그대로 프록시
    // response.body가 ReadableStream이므로 그대로 반환
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[stream] Error:', error);
    return NextResponse.json(
      { error: 'Streaming connection error' },
      { status: 500 }
    );
  }
}
