/**
 * Supabase client for ZipCheck v2
 *
 * This module provides a configured Supabase client for browser use.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Supabase client instance
 *
 * @example
 * ```ts
 * import { supabase } from '@/lib/supabase';
 *
 * // Sign in with Google
 * const { data, error } = await supabase.auth.signInWithOAuth({
 *   provider: 'google',
 * });
 * ```
 */
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // 토큰 만료 시 자동으로 localStorage에서 제거
    storageKey: 'sb-gsiismzchtgdklvdvggu-auth-token',
  },
});

/**
 * 토큰 갱신 및 인증 상태 변경 처리
 *
 * Supabase의 onAuthStateChange 리스너를 사용하여
 * 토큰 갱신, 로그인, 로그아웃 이벤트를 자동으로 처리합니다.
 */
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[Supabase 인증]', event, session?.user?.email);

    switch (event) {
      case 'TOKEN_REFRESHED':
        console.log('✅ 토큰 자동 갱신 성공');
        // 새 토큰이 자동으로 localStorage에 저장됨 (autoRefreshToken: true)
        break;

      case 'SIGNED_IN':
        console.log('✅ 사용자 로그인 완료');
        break;

      case 'SIGNED_OUT':
        console.log('🚪 사용자 로그아웃, localStorage 클리어');
        // localStorage에서 세션 데이터 클리어
        localStorage.removeItem('sb-gsiismzchtgdklvdvggu-auth-token');
        break;

      case 'USER_UPDATED':
        console.log('👤 사용자 프로필 업데이트됨');
        break;

      default:
        break;
    }
  });
}

/**
 * Create a new Supabase client instance for server-side operations
 *
 * @example
 * ```ts
 * import { createClient } from '@/lib/supabase';
 *
 * const supabase = createClient();
 * const { data, error } = await supabase.from('table').select();
 * ```
 */
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}
