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
    const backendUrl = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/reports/${caseId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch report' }));
      return NextResponse.json(
        { error: errorData.error || 'Failed to fetch report' },
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
