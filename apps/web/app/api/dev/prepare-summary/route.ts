/**
 * Dev API: 요약 리포트 생성 (디버깅 전용)
 *
 * POST /api/dev/prepare-summary
 * Body: {
 *   case_id: string,
 *   use_llm?: boolean,
 *   property_value_estimate?: number,  // Step 2 매매 실거래가 평균 (만원)
 *   jeonse_market_average?: number,    // Step 2 전세 실거래가 평균 (만원)
 *   contract_type?: string,            // Step 3 계약 유형 ("전세" | "월세" | "매매")
 *   deposit?: number,                  // Step 3 보증금 (만원) - 전세/월세
 *   price?: number,                    // Step 3 매매가 (만원) - 매매
 *   monthly_rent?: number,             // Step 3 월세 (만원) - 월세
 * }
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const {
      case_id,
      use_llm = false,
      // Step 2 데이터
      property_value_estimate,
      jeonse_market_average,
      // Step 3 유저 입력 계약 정보
      contract_type,
      deposit,
      price,
      monthly_rent,
    } = await request.json();

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

    // LLM 사용 시 더 긴 타임아웃 필요 (LLM: 120초, 규칙기반: 60초)
    const timeoutMs = use_llm ? 120000 : 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${AI_API_URL}/dev/prepare-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        case_id,
        use_llm,
        // Step 2 데이터 전달
        property_value_estimate,
        jeonse_market_average,
        // Step 3 유저 입력 계약 정보 전달
        contract_type,
        deposit,
        price,
        monthly_rent,
      }),
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
    console.error('Prepare summary error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
