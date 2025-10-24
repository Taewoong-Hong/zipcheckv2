/**
 * 관리자 권한 검증 유틸리티
 *
 * Supabase Auth + users 테이블의 role 컬럼으로 관리자 권한 확인
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * 관리자 권한 검증
 *
 * @param request - Next.js Request 객체
 * @returns 권한 검증 결과
 */
export async function verifyAdminAuth(request: NextRequest): Promise<{
  authorized: boolean;
  userId?: string;
  email?: string;
  message?: string;
}> {
  try {
    // 1. Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        authorized: false,
        message: '인증 토큰이 없습니다.',
      };
    }

    const token = authHeader.replace('Bearer ', '');

    // 2. Supabase Service Role 클라이언트로 토큰 검증
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        authorized: false,
        message: '유효하지 않은 토큰입니다.',
      };
    }

    // 3. users 테이블에서 role 확인
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError) {
      return {
        authorized: false,
        message: '사용자 정보를 조회할 수 없습니다.',
      };
    }

    if (userData?.role !== 'admin') {
      return {
        authorized: false,
        message: '관리자 권한이 없습니다.',
      };
    }

    // 4. 권한 확인 완료
    return {
      authorized: true,
      userId: user.id,
      email: user.email,
    };
  } catch (error) {
    console.error('Admin auth verification error:', error);
    return {
      authorized: false,
      message: '권한 확인 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 쿠키 기반 관리자 권한 검증 (클라이언트 세션 기반)
 *
 * @param request - Next.js Request 객체
 * @returns 권한 검증 결과
 */
export async function verifyAdminAuthFromCookies(
  cookies: Map<string, string>
): Promise<{
  authorized: boolean;
  userId?: string;
  email?: string;
  message?: string;
}> {
  try {
    // 쿠키에서 Supabase 세션 토큰 추출
    const accessToken = cookies.get('sb-access-token');
    const refreshToken = cookies.get('sb-refresh-token');

    if (!accessToken || !refreshToken) {
      return {
        authorized: false,
        message: '세션이 없습니다.',
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return {
        authorized: false,
        message: '유효하지 않은 세션입니다.',
      };
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || userData?.role !== 'admin') {
      return {
        authorized: false,
        message: '관리자 권한이 없습니다.',
      };
    }

    return {
      authorized: true,
      userId: user.id,
      email: user.email,
    };
  } catch (error) {
    console.error('Admin auth verification error:', error);
    return {
      authorized: false,
      message: '권한 확인 중 오류가 발생했습니다.',
    };
  }
}
