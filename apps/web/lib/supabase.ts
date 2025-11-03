/**
 * Supabase client for ZipCheck v2
 *
 * This module provides a configured Supabase client for browser use.
 * Uses singleton pattern to prevent multiple GoTrueClient instances.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Singleton instance
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * Get singleton Supabase client instance
 * Prevents multiple GoTrueClient instances warning
 */
function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  // localStorage 접근 가능 여부 체크
  let storage: Storage | undefined;
  if (typeof window !== 'undefined') {
    try {
      // localStorage 접근 테스트
      window.localStorage.setItem('__test__', '1');
      window.localStorage.removeItem('__test__');
      storage = window.localStorage;
    } catch (e) {
      console.warn('[Supabase] localStorage 접근 불가, 메모리 스토리지 사용');
      // localStorage 접근 불가 시 메모리 기반 스토리지 사용
      storage = undefined;
    }
  }

  supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: storage !== undefined, // localStorage 없으면 세션 유지 안 함
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: storage,
    },
  });

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
        // localStorage에서 세션 데이터 클리어 (Supabase가 자동으로 처리)
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
