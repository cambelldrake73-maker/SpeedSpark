/** Trim so .env whitespace/quotes do not break fetch on web. */
export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
export const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
/** Optional shared secret for invoking pair-live-windows from the app (must match PAIRING_CRON_SECRET). */
export const PAIRING_INVOKE_SECRET = (process.env.EXPO_PUBLIC_PAIRING_INVOKE_SECRET ?? '').trim();

function isPlaceholderSupabaseEnv(): boolean {
  const url = SUPABASE_URL.toLowerCase();
  const key = SUPABASE_ANON_KEY.toLowerCase();
  return (
    url.includes('your-project-ref') ||
    key.includes('your-anon-public-key') ||
    key === 'your-anon-key' ||
    key.length < 20
  );
}

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0 && !isPlaceholderSupabaseEnv();

export function normalizeSupabaseUrl(url: string = SUPABASE_URL): string {
  return url.trim().replace(/\/$/, '');
}

export function getSupabaseUrlDiagnostics() {
  let parsedHostname = '(invalid URL)';
  let parsedHref = '';
  try {
    const parsed = new URL(SUPABASE_URL);
    parsedHostname = parsed.hostname;
    parsedHref = parsed.href.replace(/\/$/, '');
  } catch {
    // leave defaults
  }

  const baseUrl = normalizeSupabaseUrl();

  return {
    rawEnvUrl: SUPABASE_URL,
    rawEnvUrlLength: SUPABASE_URL.length,
    /** Last segment of URL — surfaces .co vs .com typos in .env */
    rawEnvUrlTail: SUPABASE_URL.length > 30 ? SUPABASE_URL.slice(-30) : SUPABASE_URL,
    parsedHostname,
    parsedHref,
    baseUrlAfterNormalize: baseUrl,
    settingsFetchUrl: `${baseUrl}/auth/v1/settings`,
    signupFetchUrl: `${baseUrl}/auth/v1/signup`,
  };
}

/** DEV: log exact env URL vs parsed host (no key). */
export function logSupabaseUrlDiagnostics(context: string): void {
  if (!__DEV__) {
    return;
  }
  console.log(`[SpeedSpark Supabase] url diagnostics (${context})`, getSupabaseUrlDiagnostics());
}
