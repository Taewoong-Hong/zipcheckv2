/**
 * 케이스 업데이트/조회 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getBearer(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
}

function createServerSupabase(bearer: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const bearer = getBearer(request);
    if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServerSupabase(bearer);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id } = await params;

    // Map camelCase client fields to DB snake_case and whitelist
    const updates: Record<string, any> = {};
    if (typeof (body as any).contractType === 'string') updates.contract_type = (body as any).contractType;
    if (typeof (body as any).deposit === 'number') updates.contract_amount = (body as any).deposit;
    if (typeof (body as any).monthlyRent === 'number') updates.monthly_rent = (body as any).monthlyRent;
    if (typeof (body as any).current_state === 'string') updates.current_state = (body as any).current_state;
    if (typeof (body as any).state === 'string') updates.state = (body as any).state;
    if (typeof (body as any).property_address === 'string') updates.property_address = (body as any).property_address;
    if (typeof (body as any).address_road === 'string') updates.address_road = (body as any).address_road;
    if (typeof (body as any).address_lot === 'string') updates.address_lot = (body as any).address_lot;
    if ((body as any).address_detail) updates.address_detail = (body as any).address_detail;
    if ((body as any).address && typeof (body as any).address === 'object') {
      const addr = (body as any).address;
      if (typeof addr.road === 'string') updates.property_address = addr.road;
      if (typeof addr.lot === 'string') updates.address_lot = addr.lot;
      updates.address_detail = addr;
    }
    const allowedDirect = ['flags', 'metadata'];
    for (const k of allowedDirect) {
      if (k in (body as any)) updates[k] = (body as any)[k];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('v2_cases')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Update case error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ case: data });
  } catch (error) {
    console.error('Case update error:', error);
    return NextResponse.json(
      { error: 'Failed to update case' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const bearer = getBearer(request);
    if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServerSupabase(bearer);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const { data, error } = await supabase
      .from('v2_cases')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Get case error:', error);
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ case: data });
  } catch (error) {
    console.error('Case get error:', error);
    return NextResponse.json(
      { error: 'Failed to get case' },
      { status: 500 }
    );
  }
}
