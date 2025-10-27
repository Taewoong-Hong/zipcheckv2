import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { decryptFields } from '@/lib/encryption';

export async function GET(request: Request) {
  try {
    const supabase = createClient();

    // 관리자 권한 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // v2_documents와 v2_profiles 조인하여 데이터 가져오기
    const { data: documents, error } = await supabase
      .from('v2_documents')
      .select(`
        id,
        user_id,
        document_type,
        file_name,
        property_address,
        created_at,
        v2_contracts!inner (
          status,
          addr
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching documents:', error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    // 각 문서의 사용자 정보 가져오기
    const uniqueUserIds = [...new Set(documents?.map((d: any) => d.user_id) || [])];
    const userEmails = new Map<string, string>();

    for (const userId of uniqueUserIds) {
      const userIdStr = userId as string;
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userIdStr);
      if (authUser?.email) {
        userEmails.set(userIdStr, authUser.email);
      }
    }

    // 데이터 변환 및 복호화
    const dataList = (documents || []).map((doc: any) => {
      const contract = doc.v2_contracts;

      return {
        id: doc.id,
        type: doc.document_type === 'registry' ? '등기부등본' : '계약서',
        title: doc.property_address || doc.file_name || '제목 없음',
        user: userEmails.get(doc.user_id) || '알 수 없음',
        date: new Date(doc.created_at).toLocaleString('ko-KR'),
        status: contract?.status || 'unknown',
        file_name: doc.file_name,
      };
    });

    // 민감한 필드 복호화 (이메일, 주소 등)
    const decryptedData = dataList.map(item => {
      try {
        // 암호화된 필드 복호화 시도
        return decryptFields(item, ['user', 'title']);
      } catch (error) {
        // 복호화 실패 시 원본 반환 (평문 데이터 또는 마이그레이션 전)
        console.warn('Decryption failed for item:', item.id, error);
        return item;
      }
    });

    return NextResponse.json({ data: decryptedData });
  } catch (error) {
    console.error('Error in admin data API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
