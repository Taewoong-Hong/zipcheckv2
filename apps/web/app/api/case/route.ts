/**
 * 케이스 생성 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Bearer 토큰 우선 사용 (브라우저는 localStorage 보관이므로 쿠키에 없을 수 있음)
    const authHeader = request.headers.get('authorization');
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!bearer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 토큰을 모든 요청 헤더에 포함한 서버용 클라이언트 생성 (RLS 적용)
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    // 사용자 확인
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { address_road, address_lot, address_detail } = body;

    // 케이스 생성 (RLS로 현재 사용자 권한으로 실행)
    const { data: caseData, error } = await supabase
      .from('v2_cases')
      .insert({
        user_id: user.id,
        address_road,
        address_lot,
        address_detail,
        state: 'init',
      })
      .select()
      .single();

    if (error) {
      console.error('Create case error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ caseId: caseData.id, case: caseData });
  } catch (error) {
    console.error('Case creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create case' },
      { status: 500 }
    );
  }
}

