/**
 * Supabase client for ZipCheck v2
 *
 * This module provides a configured Supabase client for browser use.
 * Uses @supabase/ssr for Next.js App Router cookie-based session management.
 */

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Singleton instance
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Get singleton Supabase client instance
 * Uses @supabase/ssr for cookie-based session management
 * Prevents multiple GoTrueClient instances warning
 */
function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  // ✅ createBrowserClient는 자동으로 쿠키 + localStorage를 모두 사용
  supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);

  // 개발 환경 디버깅용
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as any)._supabase = supabaseInstance;
  }

  return supabaseInstance;
}

/**
 * Supabase client instance (singleton)
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
export const supabase = getSupabaseClient();

/**
 * 토큰 갱신 및 인증 상태 변경 처리
 *
 * Supabase의 onAuthStateChange 리스너를 사용하여
 * 토큰 갱신, 로그인, 로그아웃 이벤트를 자동으로 처리합니다.
 */
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event: any, session: any) => {
    console.log('[Supabase 인증]', event, session?.user?.email);

    switch (event) {
      case 'TOKEN_REFRESHED':
        console.log('✅ 토큰 자동 갱신 성공');
        // 새 토큰이 자동으로 쿠키 + localStorage에 저장됨
        break;

      case 'SIGNED_IN':
        console.log('✅ 사용자 로그인 완료');
        break;

      case 'SIGNED_OUT':
        console.log('🚪 사용자 로그아웃, 세션 클리어');
        // 쿠키 + localStorage에서 세션 데이터 클리어 (Supabase가 자동으로 처리)
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
 * Create a new Supabase client instance (deprecated - use singleton instead)
 *
 * @deprecated Use the singleton `supabase` instance instead
 * @example
 * ```ts
 * import { supabase } from '@/lib/supabase';
 *
 * const { data, error } = await supabase.from('table').select();
 * ```
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
