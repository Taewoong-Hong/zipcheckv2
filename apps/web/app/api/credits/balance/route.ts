/**
 * 크레딧 잔액 조회 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // 인증 확인
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: 실제 크레딧 테이블에서 조회
    // const { data, error } = await supabase
    //   .from('v2_profiles')
    //   .select('credits')
    //   .eq('user_id', session.user.id)
    //   .single();

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
