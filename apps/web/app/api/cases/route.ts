/**
 * Cases API Route
 *
 * GET /api/cases?environment=dev
 * - Fetches cases from Supabase filtered by environment
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Get environment query parameter
    const searchParams = request.nextUrl.searchParams;
    const environment = searchParams.get('environment');

    if (!environment) {
      return NextResponse.json(
        { error: 'environment parameter is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Query cases from v2_cases table
    const { data: cases, error } = await supabase
      .from('v2_cases')
      .select('*')
      .eq('environment', environment)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }

    return NextResponse.json({
      cases: cases || [],
      count: cases?.length || 0,
      environment,
    });

  } catch (error: any) {
    console.error('GET /api/cases error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
