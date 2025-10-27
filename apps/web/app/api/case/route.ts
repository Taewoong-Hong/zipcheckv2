/**
 * 케이스 생성 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // 인증 확인
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { address_road, address_lot, address_detail } = body;

    // 케이스 생성
    const { data: caseData, error } = await supabase
      .from('v2_cases')
      .insert({
        user_id: session.user.id,
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
