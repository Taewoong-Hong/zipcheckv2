import { NextRequest, NextResponse } from 'next/server';

// Conditional JUSO proxy with local-skip
// Docs: https://www.juso.go.kr/addrlink/devAddrLinkRequestGuide.do

function isLocal(req: NextRequest) {
  const h = req.nextUrl.hostname || '';
  return h === 'localhost' || h === '127.0.0.1';
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

    const key = process.env.JUSO_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'MISSING_JUSO_API_KEY' }, { status: 500 });
    }

    const url = new URL('https://www.juso.go.kr/addrlink/addrLinkApi.do');
    url.searchParams.set('confmKey', key);
    url.searchParams.set('currentPage', page);
    url.searchParams.set('countPerPage', size);
    url.searchParams.set('keyword', query);
    url.searchParams.set('resultType', 'json');

    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: 'JUSO_FAILED', details: text }, { status: 502 });
    }
    const data = await res.json();
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

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
