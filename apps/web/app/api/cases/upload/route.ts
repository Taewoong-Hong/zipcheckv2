/**
 * Case Upload API Route
 *
 * POST /api/cases/upload
 * - Handles PDF and image uploads
 * - Creates a new case in Supabase
 * - Stores the file in Supabase Storage
 * - Triggers automatic parsing
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Dev system user UUID (for uploads without authentication)
const DEV_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function POST(request: NextRequest) {
  try {
    // 1. FormData 파싱
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const environment = formData.get('environment') as string || 'dev';

    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다' },
        { status: 400 }
      );
    }

    // 2. 파일 검증
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/heic',
      'image/heif',
    ];

    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (20MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '파일 크기는 20MB 이하로 제한됩니다' },
        { status: 400 }
      );
    }

    // 3. Supabase 초기화
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. 케이스 생성
    const caseId = uuidv4();
    const timestamp = new Date().toISOString();

    // 파일 확장자 추출
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const storagePath = `${caseId}/registry.${fileExtension}`;

    // 5. Supabase Storage에 파일 업로드
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('artifacts')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`파일 업로드 실패: ${uploadError.message}`);
    }

    // 6. v2_cases 테이블에 케이스 생성
    const { data: caseData, error: caseError } = await supabase
      .from('v2_cases')
      .insert({
        id: caseId,
        user_id: DEV_SYSTEM_USER_ID, // TODO: 실제 사용자 ID로 교체
        environment: environment,
        current_state: 'registry_ready',
        property_address: `업로드된 파일: ${file.name}`,
        address_road: `업로드된 파일: ${file.name}`, // 백업 필드 (NOT NULL 제약 충족)
        contract_type: '전세', // 기본값
        created_at: timestamp,
        updated_at: timestamp,
        metadata: {
          upload_source: 'dev_upload_ui',
          original_filename: file.name,
          file_size: file.size,
          file_type: file.type,
        }
      })
      .select()
      .single();

    if (caseError) {
      console.error('Case creation error:', caseError);
      throw new Error(`케이스 생성 실패: ${caseError.message}`);
    }

    // 7. v2_artifacts 테이블에 아티팩트 생성
    const { error: artifactError } = await supabase
      .from('v2_artifacts')
      .insert({
        id: uuidv4(),
        case_id: caseId,
        user_id: DEV_SYSTEM_USER_ID,
        artifact_type: 'registry_pdf',
        file_path: `artifacts/${storagePath}`,
        file_size: file.size,
        mime_type: file.type,
        created_at: timestamp,
        metadata: {
          original_filename: file.name,
          upload_method: 'dev_upload_ui',
        }
      });

    if (artifactError) {
      console.error('Artifact creation error:', artifactError);
      // 아티팩트 생성 실패는 경고만 (케이스는 유지)
      console.warn('Warning: Artifact entry creation failed, but case was created');
    }

    // 8. 백그라운드에서 파싱 트리거 (optional)
    // TODO: FastAPI /dev/parse-registry 호출하여 자동 파싱 시작
    // 현재는 수동으로 파싱해야 함

    console.log(`✅ Case created: ${caseId}`);
    console.log(`   └─ File: ${file.name} (${file.size} bytes)`);
    console.log(`   └─ Storage: artifacts/${storagePath}`);

    return NextResponse.json({
      success: true,
      caseId: caseId,
      message: '케이스가 성공적으로 생성되었습니다',
      case: caseData,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || '업로드 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
