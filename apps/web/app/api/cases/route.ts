/**
 * Cases API Route
 *
 * GET /api/cases?environment=dev&source=lab
 * - Fetches cases from Supabase filtered by environment and source
 *
 * Lab 케이스 조회: environment=dev, source=lab
 * Service 케이스 조회: environment=prod, source=service
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const environment = searchParams.get('environment');
    const source = searchParams.get('source');

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

    // Build query with environment filter
    let query = supabase
      .from('v2_cases')
      .select('*')
      .eq('environment', environment);

    // Add source filter if provided
    if (source) {
      query = query.eq('source', source);
    }

    // Execute query with ordering
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
