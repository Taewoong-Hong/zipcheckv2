import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createClient();

    // 관리자 권한 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 통계 데이터 수집
    const [usersResult, documentsResult, paymentsResult, reportsResult] = await Promise.all([
      // 총 회원 수
      supabase.auth.admin.listUsers(),

      // 총 문서 수
      supabase.from('v2_documents').select('id', { count: 'exact', head: true }),

      // 결제 데이터는 아직 테이블이 없으므로 임시 데이터
      Promise.resolve({ data: null, error: null }),

      // 총 분석 수
      supabase.from('v2_reports').select('id', { count: 'exact', head: true }),
    ]);

    const totalUsers = usersResult.data?.users?.length || 0;
    const totalDocuments = documentsResult.count || 0;
    const totalReports = reportsResult.count || 0;

    // 오늘 날짜 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // 오늘 생성된 데이터 수집
    const [todayReportsResult, todayDocsResult] = await Promise.all([
      supabase
        .from('v2_reports')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayISO),

      supabase
        .from('v2_documents')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayISO),
    ]);

    const todayAnalyses = todayReportsResult.count || 0;
    const todayDocs = todayDocsResult.count || 0;

    // 지난 30일 트렌드 데이터
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentReports } = await supabase
      .from('v2_reports')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    return NextResponse.json({
      totalUsers,
      totalDocuments,
      totalReports,
      todayAnalyses,
      todayDocs,
      recentReports: recentReports || [],
    });
  } catch (error) {
    console.error('Error in admin stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
