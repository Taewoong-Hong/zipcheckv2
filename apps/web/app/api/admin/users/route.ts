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

    // auth.users에서 사용자 정보 가져오기
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // v2_profiles와 조인하여 추가 정보 가져오기
    const { data: profiles, error: profilesError } = await supabase
      .from('v2_profiles')
      .select('*');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    // v2_reports에서 각 사용자의 분석 횟수 가져오기
    const { data: reportCounts, error: reportCountsError } = await supabase
      .from('v2_reports')
      .select('user_id');

    if (reportCountsError) {
      console.error('Error fetching report counts:', reportCountsError);
    }

    // 사용자별 분석 횟수 계산
    const analysisCountMap = new Map<string, number>();
    if (reportCounts) {
      reportCounts.forEach((report: any) => {
        const count = analysisCountMap.get(report.user_id) || 0;
        analysisCountMap.set(report.user_id, count + 1);
      });
    }

    // 데이터 결합
    const users = authUsers.users.map((authUser: any) => {
      const profile = profiles?.find((p: any) => p.user_id === authUser.id);
      const analysisCount = analysisCountMap.get(authUser.id) || 0;

      return {
        id: authUser.id,
        email: authUser.email || '',
        name: profile?.name || authUser.user_metadata?.name || '이름 없음',
        role: authUser.role || 'user',
        status: authUser.banned_until ? 'inactive' : 'active',
        joinDate: authUser.created_at,
        analyses: analysisCount,
        lastSignIn: authUser.last_sign_in_at,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error in admin users API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
