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

    const { data, error } = await supabase
      .from('v2_cases')
      .update(body)
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

