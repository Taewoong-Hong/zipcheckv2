/**
 * 분석 실행 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient();

    // 인증 확인
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;

    // 케이스 조회
    const { data: caseData, error: caseError } = await supabase
      .from('v2_cases')
      .select('*')
      .eq('id', caseId)
      .eq('user_id', session.user.id)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // TODO: 실제 백엔드 FastAPI 서버로 분석 요청
    // const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    // const response = await fetch(`${backendUrl}/analyze/${caseId}`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    // });

    // 임시: 케이스 상태를 report로 업데이트
    await supabase
      .from('v2_cases')
      .update({ state: 'report' })
      .eq('id', caseId);

    return NextResponse.json({ ok: true, caseId });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to run analysis' },
      { status: 500 }
    );
  }
}
