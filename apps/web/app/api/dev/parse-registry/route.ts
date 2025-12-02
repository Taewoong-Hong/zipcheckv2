/**
 * Dev API: 등기부 파싱 (디버깅 전용)
 *
 * POST /api/dev/parse-registry
 * Body: { case_id: string }
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { case_id } = await request.json();
    console.log(`[parse-registry] 시작: case_id=${case_id}`);

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

    // PDF 파싱은 시간이 오래 걸릴 수 있으므로 타임아웃 설정
    // DEV_DISABLE_TIMEOUT=true 환경변수로 타임아웃 비활성화 가능 (디버깅용)
    const disableTimeout = process.env.DEV_DISABLE_TIMEOUT === 'true';
    const timeoutMs = disableTimeout ? 0 : 180000; // 180초 (3분)

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (!disableTimeout) {
      timeoutId = setTimeout(() => {
        console.log(`[parse-registry] 타임아웃 발생: ${Date.now() - startTime}ms`);
        controller.abort();
      }, timeoutMs);
    }

    console.log(`[parse-registry] FastAPI 요청 시작: ${AI_API_URL}/dev/parse-registry (타임아웃: ${disableTimeout ? '비활성화' : `${timeoutMs}ms`})`);
    const fetchStartTime = Date.now();

    const response = await fetch(`${AI_API_URL}/dev/parse-registry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ case_id }),
      signal: disableTimeout ? undefined : controller.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    const fetchTime = Date.now() - fetchStartTime;
    console.log(`[parse-registry] 응답 헤더 수신: status=${response.status}, time=${fetchTime}ms`);
    console.log(`[parse-registry] 응답 헤더:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[parse-registry] 에러 응답: ${errorText}`);
      throw new Error(`FastAPI error: ${response.status} ${errorText}`);
    }

    // JSON 파싱 시작
    console.log(`[parse-registry] JSON 파싱 시작...`);
    const jsonStartTime = Date.now();

    const result = await response.json();

    const jsonTime = Date.now() - jsonStartTime;
    const totalTime = Date.now() - startTime;
    console.log(`[parse-registry] JSON 파싱 완료: ${jsonTime}ms, 총 소요시간: ${totalTime}ms`);
    console.log(`[parse-registry] 응답 크기: success=${result.success}, execution_time_ms=${result.execution_time_ms}`);

    return NextResponse.json(result);
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[parse-registry] 오류 발생 (${totalTime}ms):`, error.name, error.message);

    // AbortError 상세 로깅
    if (error.name === 'AbortError') {
      console.error('[parse-registry] 요청이 중단되었습니다 (타임아웃 또는 수동 중단)');
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
