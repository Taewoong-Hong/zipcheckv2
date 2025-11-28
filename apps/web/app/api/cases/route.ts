/**
 * Cases API Route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const environment = searchParams.get('environment');
    const source = searchParams.get('source');

    if (!environment) {
      return NextResponse.json(
        { error: 'environment parameter is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;  // ← 변경

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);  // ← 변경

    let query = supabase
      .from('v2_cases')
      .select('*')
      .eq('environment', environment);

    if (source) {
      query = query.eq('source', source);
    }

    const { data: cases, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }

    return NextResponse.json({
      cases: cases || [],
      count: cases?.length || 0,
      environment,
      source: source || 'all',
    });

  } catch (error: any) {
    console.error('GET /api/cases error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
