import { NextRequest, NextResponse } from 'next/server';

const AI_API_URL = process.env.AI_API_URL;

export async function GET(request: NextRequest) {
  try {
    if (!AI_API_URL) {
      return NextResponse.json(
        { error: 'CONFIG_MISSING', message: 'AI_API_URL 환경변수가 설정되어 있지 않습니다' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // Get limit from query params
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '20';

    // Call FastAPI /reports endpoint
    const response = await fetch(`${AI_API_URL}/reports?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      // 빈 사용자(리포트 없음)일 수 있으니 404/204는 빈 리스트로 처리
      if (response.status === 404 || response.status === 204) {
        return NextResponse.json({ reports: [], total: 0 });
      }
      const text = await response.text();
      return NextResponse.json(
        { error: '리포트 조회 실패', status: response.status, details: text },
        { status: response.status }
      );
    }

    const reports = await response.json();
    const total = Array.isArray(reports) ? reports.length : (reports?.length ?? 0);

    return NextResponse.json({ reports, total });
  } catch (error) {
    console.error('Reports list error:', error);
    return NextResponse.json(
      {
        error: '리포트 목록 조회 중 오류가 발생했습니다',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
