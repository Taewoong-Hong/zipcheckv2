/**
 * Supabase client for ZipCheck v2
 *
 * This module provides a configured Supabase client for browser use.
 *
 * TODO: 백엔드 담당자가 @supabase/supabase-js 패키지 설치 후 주석 해제
 * npm install @supabase/supabase-js
 */

// import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// if (!supabaseUrl || !supabaseAnonKey) {
//   throw new Error('Missing Supabase environment variables');
// }

/**
 * Supabase client instance (Mock)
 *
 * TODO: 백엔드 담당자가 실제 Supabase client로 교체
 *
 * @example
 * ```ts
 * import { supabase } from '@/lib/supabase';
 *
 * // Sign in with Google
 * const { error } = await supabase.auth.signInWithOAuth({
 *   provider: 'google',
 * });
 * ```
 */
export const supabase = {
  auth: {
    signInWithOAuth: async (options: any) => {
      console.log('Mock OAuth login:', options);
      return { error: null };
    },
    signOut: async () => {
      console.log('Mock sign out');
      return { error: null };
    },
    getSession: async () => {
      console.log('Mock get session');
      return { data: { session: null }, error: null };
    },
  },
} as any;

// export const supabase = createClient(supabaseUrl, supabaseAnonKey);
