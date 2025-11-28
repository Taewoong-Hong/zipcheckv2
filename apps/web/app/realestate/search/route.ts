import { NextResponse } from 'next/server';
import { createClient } from '@/data/database/client';
import { searchTrades } from '@/lib/search-trades';

export const runtime = 'nodejs'; // Edge X (node API 쓰는 라이브러리 방지)

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lawdCd = url.searchParams.get('lawdCd') ?? '';
    const from   = url.searchParams.get('from') ?? '2000-01-01';
    const to     = url.searchParams.get('to')   ?? '2100-12-31';
    const apt    = url.searchParams.get('apt') ?? '';
    const jibun  = url.searchParams.get('jibun') ?? '';
    const fuzzy  = url.searchParams.get('fuzzy') === '1';
    const threshold = Number(url.searchParams.get('threshold') ?? '0.3');
    const sort   = (url.searchParams.get('sort') ?? 'similarity') as 'similarity'|'latest'|'price';
    const limit  = Number(url.searchParams.get('limit') ?? '200');

    if (!lawdCd) {
      return NextResponse.json({ error: 'lawdCd required' }, { status: 400 });
    }

    // 1) DB에서 1차 필터 (기간/지역)
    const supabase = createClient();
    const { data, error } = await supabase
      .from('real_estate_trades')
      .select('id, lawd_cd, deal_ymd, apartment, dong, jibun, exclusive_area, floor, deal_amount, build_year')
      .eq('lawd_cd', lawdCd)
      .gte('deal_ymd', from)
      .lte('deal_ymd', to)
      .limit(5000); // 안전선 (필요시 페이지네이션)

    if (error) {
      console.error('[SEARCH] DB Error:', error);
      // 테이블이 없거나 접근 권한이 없는 경우 빈 배열로 진행
      if (error.code === '42P01' || error.message?.includes('not exist')) {
        console.warn('[SEARCH] Table does not exist, returning empty result');
        return NextResponse.json({
          success: true,
          count: 0,
          grouped: {},
          items: [],
          params: { lawdCd, from, to, apt, jibun, fuzzy, threshold, sort, limit },
          warning: 'No data available yet. Please import trade data first.'
        });
      }
      throw error;
    }

    // 2) Fuse.js + 정규화 필터/랭킹
    const result = searchTrades((data ?? []) as any, { apt, jibun, fuzzy, threshold, sort, limit });

    return NextResponse.json({
      success: true,
      count: result.items.length,
      grouped: result.grouped,
      items: result.items,
      params: { lawdCd, from, to, apt, jibun, fuzzy, threshold, sort, limit }
    });
  } catch (e: any) {
    console.error('[SEARCH] Error:', e);
    return NextResponse.json({ error: 'search failed', detail: String(e?.message ?? e) }, { status: 500 });
  }
}