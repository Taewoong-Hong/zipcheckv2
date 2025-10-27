/**
 * 등기부 PDF 업로드 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // 인증 확인
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const caseId = formData.get('caseId') as string;

    if (!file || !caseId) {
      return NextResponse.json(
        { error: 'File and caseId are required' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // PDF 파일만 허용
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Supabase Storage에 업로드
    const fileName = `${caseId}/${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('zipcheck-documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // artifact 레코드 생성
    const { data: artifactData, error: artifactError } = await supabase
      .from('v2_artifacts')
      .insert({
        case_id: caseId,
        artifact_type: 'registry_pdf',
        file_path: uploadData.path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (artifactError) {
      console.error('Artifact creation error:', artifactError);
      return NextResponse.json(
        { error: 'Failed to create artifact record' },
        { status: 500 }
      );
    }

    // 케이스 상태 업데이트
    await supabase
      .from('v2_cases')
      .update({ state: 'registry_ready' })
      .eq('id', caseId);

    return NextResponse.json({
      artifactId: artifactData.id,
      filePath: uploadData.path,
    });
  } catch (error) {
    console.error('Registry upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload registry' },
      { status: 500 }
    );
  }
}
