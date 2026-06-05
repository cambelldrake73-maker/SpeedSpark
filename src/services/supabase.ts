import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { registerDefaultDbClientFactory } from './dbClient';
import { logSupabaseRequest } from '../utils/supabaseDebug';
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
  normalizeSupabaseUrl,
  logSupabaseUrlDiagnostics,
} from './supabaseEnv';

export {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
  normalizeSupabaseUrl,
  getSupabaseUrlDiagnostics,
  logSupabaseUrlDiagnostics,
} from './supabaseEnv';

function urlHostForLog(): string {
  try {
    return new URL(SUPABASE_URL).host;
  } catch {
    return '(invalid URL)';
  }
}

function createSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    console.warn(
      '[SpeedSpark Supabase] Client not created — missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY',
    );
    return null;
  }

  logSupabaseRequest('client.create', {
    urlHost: urlHostForLog(),
    urlLength: SUPABASE_URL.length,
    anonKeyLength: SUPABASE_ANON_KEY.length,
    platform: Platform.OS,
    detectSessionInUrl: false,
    usesGlobalFetch: typeof globalThis.fetch === 'function',
  });

  // Use default global fetch — no custom fetch/polyfill (avoids missing apikey headers).
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = createSupabaseClient();

if (__DEV__) {
  logSupabaseUrlDiagnostics('supabase.init');
  console.log('[SpeedSpark Supabase] init', {
    configured: isSupabaseConfigured,
    clientReady: Boolean(supabase),
    url: SUPABASE_URL ? `${SUPABASE_URL.slice(0, 40)}...` : '(missing)',
    anonKeyPresent: SUPABASE_ANON_KEY.length > 0,
    anonKeyLength: SUPABASE_ANON_KEY.length,
    urlHost: urlHostForLog(),
  });
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    const message =
      'Account server is not configured. Add API keys to .env and restart with npx expo start --clear';
    console.error('[SpeedSpark Supabase] requireSupabase failed', message);
    throw new Error(message);
  }
  return supabase;
}

registerDefaultDbClientFactory(() => requireSupabase());
