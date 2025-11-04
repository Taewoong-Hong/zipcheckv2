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
    const debug = request.nextUrl.searchParams.get('debug') === '1';

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    if (isLocal(request)) {
      // Local environment: skip external JUSO API
      return NextResponse.json({ skipped: true, results: [] });
    }

    const key = process.env.JUSO_API_KEY;
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
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.zipcheck.kr',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'User-Agent': 'zipcheck/2.0',
      },
      body: form.toString(),
      cache: 'no-store',
      // @ts-ignore
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: 'JUSO_FAILED', status: res.status, details: text }, { status: 502 });
    }
    const data = await res.json();
    const common = data?.results?.common;
    if (common && common.errorCode && String(common.errorCode) !== '0') {
      const payload = { error: 'JUSO_ERROR', code: common.errorCode, message: common.errorMessage, totalCount: common.totalCount };
      return NextResponse.json(debug ? { ...payload, raw: data } : payload, { status: 502 });
    }
    const list = data?.results?.juso || [];
    const results = list.map((j: any) => ({
      roadAddr: j.roadAddr,
      jibunAddr: j.jibunAddr,
      zipNo: j.zipNo,
      siNm: j.siNm,
      sggNm: j.sggNm,
      emdNm: j.emdNm,
      bdNm: j.bdNm,
      roadAddrPart1: j.roadAddrPart1,
      roadAddrPart2: j.roadAddrPart2,
    }));

    return NextResponse.json(debug ? { results, raw: data } : { results });
  } catch (error) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
