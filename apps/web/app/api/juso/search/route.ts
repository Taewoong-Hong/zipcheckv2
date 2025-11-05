import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Conditional JUSO proxy with local-skip
// Docs: https://www.juso.go.kr/addrlink/devAddrLinkRequestGuide.do

function isLocal(req: NextRequest) {
  const h = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.hostname || '';
  return h.includes('localhost') || h.startsWith('127.0.0.1');
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('query') || '';
    const page = request.nextUrl.searchParams.get('page') || '1';
    const size = request.nextUrl.searchParams.get('size') || '10';

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    if (isLocal(request)) {
      // Local environment: skip external JUSO API
      return NextResponse.json({ skipped: true, results: [] });
    }

    // V1 호환: KEYWORD_JUSO_API_KEY 우선, 없으면 JUSO_API_KEY 사용
    const key = process.env.KEYWORD_JUSO_API_KEY || process.env.JUSO_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'MISSING_JUSO_API_KEY' }, { status: 500 });
    }

    const form = new URLSearchParams();
    form.set('confmKey', key);
    form.set('currentPage', page);
    form.set('countPerPage', size);
    form.set('keyword', query);
    form.set('resultType', 'json');

    const res = await fetch('https://www.juso.go.kr/addrlink/addrLinkApi.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://www.zipcheck.kr',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: form.toString(),
    });

    // V1 방식: 텍스트로 먼저 받고 JSON 파싱
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      // JSONP 형식 fallback
      const jsonMatch = text.match(/callback\(([\s\S]*)\);?$/);
      if (jsonMatch) {
        try {
          data = JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.error('JUSO API 파싱 실패:', text.substring(0, 500));
          return NextResponse.json({ error: 'PARSE_ERROR', results: [] }, { status: 500 });
        }
      } else {
        console.error('JUSO API 파싱 실패:', text.substring(0, 500));
        return NextResponse.json({ error: 'PARSE_ERROR', results: [] }, { status: 500 });
      }
    }

    const common = data?.results?.common;

    // V1 방식: errorCode === '0' 문자열 비교
    if (common?.errorCode === '0') {
      // 성공: results.juso 배열 반환 (V2 UI에 맞춤)
      const list = data.results?.juso || [];
      return NextResponse.json({ results: list });
    } else {
      // API 에러 (로그만 출력하고 빈 배열 반환)
      console.error('JUSO API 에러:', {
        errorCode: common?.errorCode,
        errorMessage: common?.errorMessage,
        totalCount: common?.totalCount
      });
      return NextResponse.json({ error: common?.errorMessage || 'API 오류', results: [] });
    }

  } catch (error) {
    console.error('JUSO API 호출 실패:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : '서버 오류',
      results: []
    }, { status: 500 });
  }
}
