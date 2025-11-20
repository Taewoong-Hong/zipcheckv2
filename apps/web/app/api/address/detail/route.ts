import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * JUSO API 건물 상세 조회 (동/층/호 정보)
 *
 * 2단계 API 호출:
 * 1. searchType=dong: 동 리스트 조회
 * 2. searchType=floorho + dongNm: 해당 동의 층/호 리스트 조회
 *
 * Query Parameters:
 * - admCd: 행정구역코드 (필수)
 * - rnMgtSn: 도로명코드 (필수)
 * - udrtYn: 지하여부 (필수, 0=지상, 1=지하)
 * - buldMnnm: 건물본번 (필수)
 * - buldSlno: 건물부번 (필수)
 * - searchType: 'dong' | 'floorho' (필수)
 * - dongNm: 동 이름 (searchType=floorho일 때 필수)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const admCd = url.searchParams.get('admCd');
    const rnMgtSn = url.searchParams.get('rnMgtSn');
    const udrtYn = url.searchParams.get('udrtYn') || '0';
    const buldMnnm = url.searchParams.get('buldMnnm');
    const buldSlno = url.searchParams.get('buldSlno') || '0';
    const searchType = url.searchParams.get('searchType') || 'dong';
    const dongNm = url.searchParams.get('dongNm') || '';

    // 필수 파라미터 검증
    if (!admCd || !rnMgtSn || !buldMnnm) {
      return NextResponse.json(
        { error: 'MISSING_PARAMETERS', required: ['admCd', 'rnMgtSn', 'buldMnnm'] },
        { status: 400 }
      );
    }

    // API 키 확인
    const key = process.env.KEYWORD_JUSO_API_KEY || process.env.JUSO_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'MISSING_JUSO_API_KEY' }, { status: 500 });
    }

    // JUSO API 건물 상세 조회 요청 (JSONP)
    const form = new URLSearchParams();
    form.set('confmKey', key);
    form.set('admCd', admCd);
    form.set('rnMgtSn', rnMgtSn);
    form.set('udrtYn', udrtYn);
    form.set('buldMnnm', buldMnnm);
    form.set('buldSlno', buldSlno);
    form.set('searchType', searchType);
    form.set('resultType', 'json');

    if (searchType === 'floorho' && dongNm) {
      form.set('dongNm', dongNm);
    }

    const res = await fetch('https://business.juso.go.kr/addrlink/addrDetailApiJsonp.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://business.juso.go.kr/',
        Origin: 'https://business.juso.go.kr',
      },
      body: form.toString(),
      cache: 'no-store',
      // @ts-ignore
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: 'JUSO_DETAIL_FAILED', status: res.status, details: text },
        { status: 502 }
      );
    }

    const responseText = await res.text();

    // JSONP 응답 파싱 (callback 함수 제거)
    let jsonData;
    try {
      const patterns = [
        /callback\((.*)\);?$/,  // callback({data});
        /\w+\((.*)\);?$/,       // 함수명({data});
        /\{[\s\S]*\}/           // 순수 JSON ([\s\S]는 s 플래그 대체)
      ];

      let parsed = false;
      for (const pattern of patterns) {
        const match = responseText.match(pattern);
        if (match) {
          try {
            jsonData = JSON.parse(match[1] || match[0]);
            parsed = true;
            break;
          } catch (e) {
            continue;
          }
        }
      }

      if (!parsed) {
        throw new Error('JSONP 파싱 실패');
      }
    } catch (parseError) {
      return NextResponse.json(
        {
          error: 'JSON_PARSE_ERROR',
          details: parseError instanceof Error ? parseError.message : 'Unknown error',
          rawResponse: responseText.substring(0, 500),
        },
        { status: 500 }
      );
    }

    // 에러 체크
    const common = jsonData?.results?.common;
    if (common && common.errorCode && String(common.errorCode) !== '0') {
      return NextResponse.json(
        {
          error: 'JUSO_DETAIL_ERROR',
          code: common.errorCode,
          message: common.errorMessage,
        },
        { status: 502 }
      );
    }

    // 건물 상세 정보 추출
    const juso = jsonData?.results?.juso || [];

    if (searchType === 'dong') {
      // 동 리스트 추출
      const dongSet = new Set<string>();
      juso.forEach((item: any) => {
        const dongName = item.dongNm || '';
        if (dongName && dongName.trim()) {
          dongSet.add(dongName);
        }
      });

      const dongList = dongSet.size > 0
        ? Array.from(dongSet).map(dongNm => ({ dongNm }))
        : [{ dongNm: "'동'없음" }];

      return NextResponse.json({
        dongList,
        hasDong: dongSet.size > 0,
      });
    } else if (searchType === 'floorho') {
      // 층/호 리스트 추출
      const floorSet = new Set<string>();
      const hoMap = new Map<string, Set<string>>();

      juso.forEach((item: any) => {
        const floorName = item.floorNm || "'층'없음";
        const hoName = item.hoNm || "'호'없음";

        floorSet.add(floorName);

        if (!hoMap.has(floorName)) {
          hoMap.set(floorName, new Set());
        }
        hoMap.get(floorName)!.add(hoName);
      });

      // 층 정렬
      const floorList = Array.from(floorSet).sort((a, b) => {
        if (a === "'층'없음") return 1;
        if (b === "'층'없음") return -1;

        const isBasementA = a.includes('지하');
        const isBasementB = b.includes('지하');

        if (isBasementA && !isBasementB) return 1;
        if (!isBasementA && isBasementB) return -1;

        const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
        const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;

        return numA - numB;
      });

      // 층별 호 매핑
      const floorHoMapping: Record<string, string[]> = {};
      hoMap.forEach((hoSet, floor) => {
        floorHoMapping[floor] = Array.from(hoSet).sort((a, b) => {
          if (a === "'호'없음") return 1;
          if (b === "'호'없음") return -1;

          const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
          const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;

          return numA - numB;
        });
      });

      return NextResponse.json({
        floorList,
        floorHoMapping,
      });
    }

    return NextResponse.json({ error: 'INVALID_SEARCH_TYPE' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'SERVER_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
