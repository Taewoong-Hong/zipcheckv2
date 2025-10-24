/**
 * 관리자 로그인 인증 API
 *
 * POST /api/admin/auth
 *
 * 환경변수에 저장된 관리자 ID/PW와 비교하여 인증
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // 환경변수에서 관리자 계정 정보 가져오기
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error('ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { message: '서버 설정 오류' },
        { status: 500 }
      );
    }

    // ID/PW 검증
    if (username !== adminUsername || password !== adminPassword) {
      // 보안: 실패 시 약간의 지연 추가 (brute force 방지)
      await new Promise(resolve => setTimeout(resolve, 1000));

      return NextResponse.json(
        { message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 로그인 성공
    return NextResponse.json({
      success: true,
      message: '로그인 성공',
    });
  } catch (error: any) {
    console.error('관리자 로그인 에러:', error);
    return NextResponse.json(
      { message: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
