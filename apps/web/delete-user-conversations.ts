import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gsiismzchtgdklvdvggu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpzdpzbXpjaHRnZGtsdmR2Z2d1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzM2ODczMiwiZXhwIjoyMDUyOTQ0NzMyfQ.sb_secret_mWrf_bxAOf0Q0UP5GYg_Sg_GaixqH8B'
);

(async () => {
  try {
    console.log('🔍 사용자 검색 중...');

    // 1. 이메일로 user_id 찾기
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error('❌ 사용자 조회 실패:', userError);
      process.exit(1);
    }

    const targetUser = users.users.find(u => u.email === 'ghdxodnd@gmail.com');

    if (!targetUser) {
      console.log('❌ 해당 이메일의 사용자를 찾을 수 없습니다.');
      process.exit(1);
    }

    console.log('✅ 사용자 찾음:', targetUser.email);
    console.log('   User ID:', targetUser.id);

    // 2. 해당 사용자의 모든 대화 조회
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, title, created_at, is_archived')
      .eq('user_id', targetUser.id);

    if (convError) {
      console.error('❌ 대화 조회 실패:', convError);
      process.exit(1);
    }

    console.log('\n📊 대화 현황:');
    console.log('   전체 대화 수:', conversations.length);
    console.log('   이미 아카이브된 대화:', conversations.filter(c => c.is_archived).length);
    console.log('   활성 대화:', conversations.filter(c => !c.is_archived).length);

    // 3. 모든 대화를 아카이브 처리 (소프트 삭제)
    const activeConversations = conversations.filter(c => !c.is_archived);

    if (activeConversations.length === 0) {
      console.log('\n✅ 삭제할 활성 대화가 없습니다.');
      process.exit(0);
    }

    console.log('\n🗑️  활성 대화 삭제 중...');

    const { data: updated, error: updateError } = await supabase
      .from('conversations')
      .update({
        is_archived: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', targetUser.id)
      .eq('is_archived', false)
      .select('id');

    if (updateError) {
      console.error('❌ 아카이브 실패:', updateError);
      process.exit(1);
    }

    console.log('\n✅ 삭제 완료!');
    console.log('   아카이브 처리된 대화 수:', updated ? updated.length : 0);
    console.log('\n💡 대화 기록이 모두 사이드바에서 제거되었습니다.');
    console.log('   (데이터는 is_archived=true 상태로 보존됨)');

  } catch (error) {
    console.error('❌ 예상치 못한 오류:', error);
    process.exit(1);
  }
})();
