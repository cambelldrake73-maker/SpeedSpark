/**
 * Supabase integration placeholder.
 * Connect when EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set.
 *
 * Future usage:
 *   import { createClient } from '@supabase/supabase-js';
 *   export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

export const supabase = null;
