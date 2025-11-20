import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/report/[caseId]
 *
 * 분석 리포트 조회
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await context.params;

    if (!caseId) {
      return NextResponse.json(
        { error: 'Case ID is required' },
        { status: 400 }
      );
    }

    // FastAPI 백엔드에서 리포트 조회
    const backendUrl = process.env.NEXT_PUBLIC_AI_API_URL;

    if (!backendUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_AI_API_URL 환경변수가 설정되어 있지 않습니다' },
        { status: 500 }
      );
    }
    // 인증 헤더 추출
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing authentication header' },
        { status: 401 }
      );
    }

    // 🔍 디버그 로깅
    console.log('[DEBUG] API Route - caseId:', caseId);
    console.log('[DEBUG] API Route - backendUrl:', backendUrl);
    console.log('[DEBUG] API Route - authHeader:', authHeader ? 'present ✅' : 'missing ❌');
    console.log('[DEBUG] API Route - Fetching:', `${backendUrl}/reports/${caseId}`);

    const response = await fetch(`${backendUrl}/reports/${caseId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader, // ✅ 인증 헤더 전달
      },
    });

    console.log('[DEBUG] API Route - Response status:', response.status);
    console.log('[DEBUG] API Route - Response ok:', response.ok);

    if (!response.ok) {
      const text = await response.text(); // 그냥 text로 통째로 보기
      console.error('[DEBUG] API Route - Error body:', text);

      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {}

      return NextResponse.json(
        {
          error: 'Failed to fetch report',
          detail: parsed?.detail ?? parsed ?? text,
        },
        { status: response.status }
      );
    }

    const reportData = await response.json();

    // 리포트 데이터 반환
    return NextResponse.json({
      content: reportData.content || reportData.report_content,
      contractType: reportData.contract_type,
      address: reportData.address || reportData.property_address,
      riskScore: reportData.risk_score,
      createdAt: reportData.created_at,
    });
  } catch (error) {
    console.error('Get report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
