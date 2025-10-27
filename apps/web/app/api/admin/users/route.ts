import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/encryption';

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

    // 데이터 결합 및 복호화
    const users = authUsers.users.map((authUser: any) => {
      const profile = profiles?.find((p: any) => p.user_id === authUser.id);
      const analysisCount = analysisCountMap.get(authUser.id) || 0;

      // 암호화된 이름 복호화 시도
      let decryptedName = profile?.name || authUser.user_metadata?.name || '이름 없음';
      if (profile?.name) {
        try {
          decryptedName = decrypt(profile.name);
        } catch (error) {
          // 복호화 실패 시 원본 사용 (평문 데이터 또는 마이그레이션 전)
          console.warn(`Failed to decrypt name for user ${authUser.id}:`, error);
        }
      }

      // 암호화된 이메일 복호화 시도 (필요한 경우)
      let decryptedEmail = profile?.email || authUser.email || '';
      if (profile?.email && profile.email !== authUser.email) {
        try {
          decryptedEmail = decrypt(profile.email);
        } catch (error) {
          // 복호화 실패 시 auth.users의 이메일 사용
          console.warn(`Failed to decrypt email for user ${authUser.id}:`, error);
          decryptedEmail = authUser.email || '';
        }
      }

      // 전화번호 가져오기 (auth.users의 user_metadata에서 또는 v2_profiles에서)
      let phone = authUser.user_metadata?.phone || profile?.phone_number || '';

      // 성별 가져오기
      const gender = profile?.gender || authUser.user_metadata?.gender || null;

      // 연령대 가져오기
      const ageGroup = profile?.age_group || authUser.user_metadata?.age_group || null;

      return {
        id: authUser.id,
        email: decryptedEmail,
        name: decryptedName,
        gender: gender,
        age_group: ageGroup,
        phone: phone,
        role: authUser.role || 'user',
        status: authUser.banned_until ? 'inactive' : 'active',
        created_at: authUser.created_at,
        analyses: analysisCount,
        lastSignIn: authUser.last_sign_in_at,
      };
    });

    return NextResponse.json({
      users,
      total: users.length
    });
  } catch (error) {
    console.error('Error in admin users API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
