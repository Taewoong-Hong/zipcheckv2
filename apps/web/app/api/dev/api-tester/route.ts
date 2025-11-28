/**
 * API Tester Proxy Route
 *
 * FastAPI 백엔드의 /api-tester 엔드포인트를 프록시합니다.
 *
 * 사용법:
 * - case_id가 있으면: /api-tester/test-by-case/{case_id} 호출 (실제 주소 데이터)
 * - case_id가 없으면: /api-tester/test-all 호출 (기본 테스트 데이터)
 */
import { NextRequest, NextResponse } from 'next/server';

const AI_API_URL = process.env.AI_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const case_id = searchParams.get('case_id');

    let url: string;

    if (case_id) {
      // 케이스 ID가 있으면 실제 주소 데이터로 API 테스트
      url = `${AI_API_URL}/api-tester/test-by-case/${case_id}`;
      console.log(`[API Tester] Testing with case: ${case_id}`);
    } else {
      // 케이스 ID가 없으면 기본 테스트 파라미터 사용
      const lawd_cd = searchParams.get('lawd_cd') || '11680';
      const deal_ymd = searchParams.get('deal_ymd') || '';
      const sigungu_cd = searchParams.get('sigungu_cd') || '11680';
      const bjdong_cd = searchParams.get('bjdong_cd') || '10300';

      const params = new URLSearchParams();
      params.set('lawd_cd', lawd_cd);
      if (deal_ymd) params.set('deal_ymd', deal_ymd);
      params.set('sigungu_cd', sigungu_cd);
      params.set('bjdong_cd', bjdong_cd);

      url = `${AI_API_URL}/api-tester/test-all?${params.toString()}`;
      console.log(`[API Tester] Testing with defaults`);
    }

    console.log(`[API Tester] Calling: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API Tester] Error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Backend error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[API Tester] Success: ${data.success_count}/${data.total_apis} APIs passed`);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API Tester] Exception:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
