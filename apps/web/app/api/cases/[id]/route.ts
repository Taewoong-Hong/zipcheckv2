/**
 * Case Detail API Route
 *
 * GET /api/cases/[id]
 * - Fetches a single case by ID from Supabase
 * - Returns case data with artifacts (registry PDF, etc.)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;

    if (!caseId) {
      return NextResponse.json(
        { error: 'Case ID is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // 변경 후
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query case from v2_cases table
    const { data: caseData, error: caseError } = await supabase
      .from('v2_cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (caseError) {
      if (caseError.code === 'PGRST116') {
        return NextResponse.json(
          { error: '케이스를 찾을 수 없습니다' },
          { status: 404 }
        );
      }
      throw new Error(`Supabase query error: ${caseError.message}`);
    }

    // Query artifacts related to this case
    const { data: artifacts, error: artifactError } = await supabase
      .from('v2_artifacts')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (artifactError) {
      console.error('Artifact query error:', artifactError);
      // Artifact 조회 실패는 경고만 (케이스 데이터는 반환)
    }

    // Query reports related to this case (if any)
    const { data: reports, error: reportError } = await supabase
      .from('v2_reports')
      .select('id, created_at, risk_score, metadata')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (reportError) {
      console.error('Report query error:', reportError);
      // Report 조회 실패는 경고만
    }

    return NextResponse.json({
      case: caseData,
      artifacts: artifacts || [],
      latestReport: reports && reports.length > 0 ? reports[0] : null,
    });

  } catch (error: any) {
    console.error('GET /api/cases/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const environment = request.nextUrl.searchParams.get('environment') || 'dev';

    if (!caseId) {
      return NextResponse.json(
        { error: 'Case ID is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: caseData, error: fetchError } = await supabase
      .from('v2_cases')
      .select('environment')
      .eq('id', caseId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Case not found' },
          { status: 404 }
        );
      }
      throw new Error(`Supabase query error: ${fetchError.message}`);
    }

    if (caseData.environment !== environment) {
      return NextResponse.json(
        { error: 'Environment mismatch' },
        { status: 403 }
      );
    }

    const { error: artifactDeleteError } = await supabase
      .from('v2_artifacts')
      .delete()
      .eq('case_id', caseId);

    if (artifactDeleteError) {
      throw new Error(`Failed to delete artifacts: ${artifactDeleteError.message}`);
    }

    const { error: reportDeleteError } = await supabase
      .from('v2_reports')
      .delete()
      .eq('case_id', caseId);

    if (reportDeleteError) {
      throw new Error(`Failed to delete reports: ${reportDeleteError.message}`);
    }

    const { error: caseDeleteError } = await supabase
      .from('v2_cases')
      .delete()
      .eq('id', caseId);

    if (caseDeleteError) {
      throw new Error(`Failed to delete case: ${caseDeleteError.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /api/cases/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
