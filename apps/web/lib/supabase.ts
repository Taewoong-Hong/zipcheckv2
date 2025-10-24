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
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

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
