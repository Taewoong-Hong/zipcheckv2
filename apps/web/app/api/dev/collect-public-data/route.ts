/**
 * Dev API: 공공 데이터 수집 (디버깅 전용)
 *
 * POST /api/dev/collect-public-data
 * Body: { case_id: string, force?: boolean }
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { case_id, force = false } = await request.json();

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

    // 공공 데이터 수집은 여러 API를 호출하므로 90초 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90초

    const response = await fetch(`${AI_API_URL}/dev/collect-public-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ case_id, force }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI error: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Collect public data error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
