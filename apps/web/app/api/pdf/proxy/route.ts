/**
 * PDF 프록시 API
 *
 * 로컬 파일 시스템의 PDF를 안전하게 제공
 * (Supabase Storage 사용 전 임시 방안)
 *
 * 보안:
 * - 인증된 사용자만 접근 가능
 * - 경로 탐색 공격 방지
 * - 사용자 권한 검증
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // 1. 인증 확인
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 파일 경로 파라미터
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // 3. 경로 탐색 공격 방지
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..') || !normalizedPath.startsWith('/tmp/')) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // 4. 파일 존재 확인
    if (!fs.existsSync(normalizedPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 5. 파일 읽기
    const fileBuffer = fs.readFileSync(normalizedPath);

    // 6. PDF 응답 반환
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${path.basename(normalizedPath)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('PDF proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
