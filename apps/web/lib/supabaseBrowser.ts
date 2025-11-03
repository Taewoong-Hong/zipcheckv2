// Reuse the browser supabase singleton from supabase.ts to avoid
// creating multiple GoTrueClient instances under the same storage key.
import { supabase } from './supabase';

export function getBrowserSupabase() {
  return supabase;
}
