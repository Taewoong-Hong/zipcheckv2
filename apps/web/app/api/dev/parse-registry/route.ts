/**
 * Dev API: 등기부 파싱 (디버깅 전용)
 *
 * POST /api/dev/parse-registry
 * Body: { case_id: string }
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { case_id } = await request.json();

    if (!case_id) {
      return NextResponse.json(
        { error: 'case_id is required' },
        { status: 400 }
      );
    }

    // FastAPI 백엔드 호출
    const AI_API_URL = process.env.AI_API_URL;
    if (!AI_API_URL) {
      throw new Error('AI_API_URL 환경변수가 설정되어 있지 않습니다');
    }

    const response = await fetch(`${AI_API_URL}/dev/parse-registry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ case_id }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI error: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Parse registry error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
