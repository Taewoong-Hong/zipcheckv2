/**
 * 크레딧 잔액 조회 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // TODO: 실제 크레딧 테이블에서 조회
    // const { data, error: creditsErr } = await supabase
    //   .from('v2_profiles')
    //   .select('credits')
    //   .eq('user_id', user.id)
    //   .single();
    // if (creditsErr) throw creditsErr;
    // return NextResponse.json({ balance: data.credits });

    // 임시: 기본값 반환
    return NextResponse.json({ balance: 100 });
  } catch (error) {
    console.error('Credits balance error:', error);
    return NextResponse.json(
      { error: 'Failed to get credits balance' },
      { status: 500 }
    );
  }
}

