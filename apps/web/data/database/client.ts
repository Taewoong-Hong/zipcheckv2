/**
 * Stub file for database client
 *
 * This is a placeholder for v1 database functionality.
 * The actual implementation would use Supabase client.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Create a stub Supabase client
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[database/client] Missing Supabase credentials - using stub client');
    // Return a mock client that logs operations
    return {
      from: (table: string) => ({
        select: (columns?: string) => ({
          eq: (column: string, value: any) => ({
            gte: (column: string, value: any) => ({
              lte: (column: string, value: any) => ({
                limit: (n: number) => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
          limit: (n: number) => Promise.resolve({ data: [], error: null }),
        }),
        insert: (data: any) => Promise.resolve({ data: null, error: null }),
        update: (data: any) => ({
          eq: (column: string, value: any) => Promise.resolve({ data: null, error: null }),
        }),
        delete: () => ({
          eq: (column: string, value: any) => Promise.resolve({ data: null, error: null }),
        }),
      }),
    };
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

export default createClient;
