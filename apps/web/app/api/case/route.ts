/**
 * 케이스 생성 API (schema-compatible)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Use Bearer token from client session
    const authHeader = request.headers.get('authorization');
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!bearer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Token-based Supabase client (RLS)
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    // Auth check
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { address_road, address_lot, address_detail } = body;

    // Property address 구성 (fallback 처리)
    const propertyAddress: string = address_road || address_lot || address_detail?.road || address_detail?.lot || '';

    // address_road는 NOT NULL이므로 fallback 값 제공
    const addressRoad = address_road || propertyAddress || '주소 선택 중';

    // 데이터베이스 실제 스키마에 맞춰서 insert
    // v2_cases 테이블 구조:
    // - address_road: NOT NULL
    // - property_address: nullable
    // - current_state: NOT NULL (default 'init')
    // - contract_type: nullable
    const insertData = {
      user_id: user.id,
      address_road: addressRoad,  // NOT NULL이므로 반드시 값 제공
      address_lot,
      address_detail,
      property_address: propertyAddress || null,  // nullable
      current_state: 'init',  // NOT NULL, default 값 사용
      // contract_type은 nullable이므로 생략 (나중에 업데이트)
    };

    // 케이스 생성
    const { data: caseData, error: insertError } = await supabase
      .from('v2_cases')
      .insert(insertData)
      .select()
      .single();

    if (insertError || !caseData) {
      console.error('Create case error:', insertError);
      return NextResponse.json({ error: insertError?.message || 'Failed to create case' }, { status: 500 });
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

