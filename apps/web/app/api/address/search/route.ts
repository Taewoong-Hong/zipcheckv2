import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Back-compat alias for legacy AddressSearchSelector
// Proxies to JUSO, but in local/dev returns a mock result using the query itself.

function isLocal(req: NextRequest) {
  const h = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.hostname || '';
  return h.includes('localhost') || h.startsWith('127.0.0.1');
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || url.searchParams.get('query') || '';
    const size = url.searchParams.get('size') || '10';

    if (!q) return NextResponse.json({ results: [] });

    if (isLocal(request)) {
      // Local environment: pretend the user's query is a valid single result
      return NextResponse.json({
        results: [
          {
            roadAddr: q,
            jibunAddr: q,
            zipNo: '',
            bdNm: '',
            admCd: '',
            rnMgtSn: '',
            udrtYn: 'N',
            buldMnnm: '',
            buldSlno: '',
            detBdNmList: '',
          },
        ],
      });
    }

    const key = process.env.JUSO_API_KEY;
    if (!key) return NextResponse.json({ error: 'MISSING_JUSO_API_KEY' }, { status: 500 });

    const form = new URLSearchParams();
    form.set('confmKey', key);
    form.set('currentPage', '1');
    form.set('countPerPage', size);
    form.set('keyword', q);
    form.set('resultType', 'json');

    const res = await fetch('https://www.juso.go.kr/addrlink/addrLinkApi.do', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.zipcheck.kr',
        'User-Agent': 'zipcheck/2.0',
      },
      body: form.toString(),
      cache: 'no-store',
      // @ts-ignore
      next: { revalidate: 0 },
    });
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
      bdNm: j.bdNm,
      admCd: j.admCd,
      rnMgtSn: j.rnMgtSn,
      udrtYn: j.udrtYn,
      buldMnnm: j.buldMnnm,
      buldSlno: j.buldSlno,
      detBdNmList: j.detBdNmList,
    }));
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: 'SERVER_ERROR', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
