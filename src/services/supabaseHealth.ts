import { Platform } from 'react-native';
import { logSupabaseError, logSupabaseRequest } from '../utils/supabaseDebug';
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
  normalizeSupabaseUrl,
  getSupabaseUrlDiagnostics,
  logSupabaseUrlDiagnostics,
} from './supabaseEnv';
import { requireSupabase } from './supabase';

export interface SupabaseConfigSnapshot {
  platform: string;
  configured: boolean;
  urlLength: number;
  urlHost: string;
  urlProtocol: string;
  urlValid: boolean;
  urlPrefix: string;
  /** Tail of EXPO_PUBLIC_SUPABASE_URL — helps spot .co vs .com in .env */
  envUrlTail: string;
  anonKeyPresent: boolean;
  anonKeyLength: number;
  /** Confirms createClient was called with the same trimmed env values. */
  clientReceivesSameUrl: boolean;
  clientReceivesSameKeyLength: boolean;
}

export interface FetchHealthResult {
  ok: boolean;
  status: number;
  statusText: string;
  bodyPreview: string;
  fetchError?: string;
}

export interface SupabaseConnectionTestResult {
  config: SupabaseConfigSnapshot;
  settingsFetch: FetchHealthResult;
  rawSignUpFetch: FetchHealthResult | null;
  clientSignUpProbe: {
    ok: boolean;
    errorMessage?: string;
    errorStatus?: number;
    errorName?: string;
    hasUser?: boolean;
  } | null;
  summary: string;
}

function normalizeBaseUrl(url: string): string {
  return normalizeSupabaseUrl(url);
}

function parseUrlMeta(url: string): Pick<
  SupabaseConfigSnapshot,
  'urlHost' | 'urlProtocol' | 'urlValid'
> {
  try {
    const parsed = new URL(url);
    return {
      urlHost: parsed.host,
      urlProtocol: parsed.protocol,
      urlValid: parsed.protocol === 'https:' && parsed.host.length > 0,
    };
  } catch {
    return { urlHost: '(invalid URL)', urlProtocol: '', urlValid: false };
  }
}

/** Snapshot of env + client config (never logs secrets). */
export function getSupabaseConfigSnapshot(): SupabaseConfigSnapshot {
  const urlMeta = parseUrlMeta(SUPABASE_URL);
  let clientUrl = '';
  let clientKeyLength = 0;

  try {
    const client = requireSupabase();
    const internal = client as unknown as {
      supabaseUrl?: string;
      supabaseKey?: string;
    };
    clientUrl = internal.supabaseUrl ?? '';
    clientKeyLength = internal.supabaseKey?.length ?? 0;
  } catch {
    clientUrl = '';
    clientKeyLength = 0;
  }

  return {
    platform: Platform.OS,
    configured: isSupabaseConfigured,
    urlLength: SUPABASE_URL.length,
    urlPrefix: SUPABASE_URL ? `${SUPABASE_URL.slice(0, 40)}...` : '(missing)',
    envUrlTail: SUPABASE_URL.length > 30 ? SUPABASE_URL.slice(-30) : SUPABASE_URL,
    anonKeyPresent: SUPABASE_ANON_KEY.length > 0,
    anonKeyLength: SUPABASE_ANON_KEY.length,
    clientReceivesSameUrl: clientUrl === normalizeBaseUrl(SUPABASE_URL),
    clientReceivesSameKeyLength: clientKeyLength === SUPABASE_ANON_KEY.length,
    ...urlMeta,
  };
}

function authHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

/** Direct fetch health check — same URL/key the app uses, no custom fetch wrapper. */
export async function fetchAuthSettingsHealth(): Promise<FetchHealthResult> {
  const baseUrl = normalizeBaseUrl(SUPABASE_URL);
  const settingsUrl = `${baseUrl}/auth/v1/settings?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`;
  const diagnostics = getSupabaseUrlDiagnostics();

  logSupabaseUrlDiagnostics('health.authSettings');
  logSupabaseRequest('health.authSettings', {
    parsedHostname: diagnostics.parsedHostname,
    baseUrlAfterNormalize: diagnostics.baseUrlAfterNormalize,
    settingsFetchUrl: diagnostics.settingsFetchUrl,
    method: 'GET',
  });

  try {
    const response = await fetch(settingsUrl, {
      method: 'GET',
      headers: authHeaders(),
    });
    const body = await response.text();
    const result: FetchHealthResult = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      bodyPreview: body.slice(0, 300),
    };

    console.log('[SpeedSpark Supabase] health.authSettings response', {
      fetchUrlUsed: diagnostics.settingsFetchUrl,
      parsedHostname: diagnostics.parsedHostname,
      status: result.status,
      statusText: result.statusText,
      ok: result.ok,
      bodyLength: body.length,
      bodyPreview: result.bodyPreview,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logSupabaseError('health.authSettings', error);
    return {
      ok: false,
      status: 0,
      statusText: 'fetch failed',
      bodyPreview: '',
      fetchError: message,
    };
  }
}

/** POST signup with empty body — expects 4xx JSON, proves auth API is reachable. */
export async function probeRawAuthSignUpFetch(): Promise<FetchHealthResult> {
  const baseUrl = normalizeBaseUrl(SUPABASE_URL);
  const signupUrl = `${baseUrl}/auth/v1/signup`;
  const diagnostics = getSupabaseUrlDiagnostics();

  logSupabaseRequest('health.rawSignUp', {
    parsedHostname: diagnostics.parsedHostname,
    signupFetchUrl: diagnostics.signupFetchUrl,
    method: 'POST',
  });

  try {
    const response = await fetch(signupUrl, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const body = await response.text();
    const result: FetchHealthResult = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      bodyPreview: body.slice(0, 300),
    };

    console.log('[SpeedSpark Supabase] health.rawSignUp response', {
      status: result.status,
      statusText: result.statusText,
      bodyPreview: result.bodyPreview,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logSupabaseError('health.rawSignUp', error);
    return {
      ok: false,
      status: 0,
      statusText: 'fetch failed',
      bodyPreview: '',
      fetchError: message,
    };
  }
}

export function serializeAuthError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') {
    return { raw: String(error) };
  }

  const e = error as Record<string, unknown>;
  return {
    name: e.name,
    message: e.message,
    status: e.status,
    code: e.code,
    details: e.details,
    hint: e.hint,
    stack: error instanceof Error ? error.stack : undefined,
    cause:
      error instanceof Error && error.cause
        ? serializeAuthError(error.cause)
        : e.cause,
  };
}

/** Logged when client signUp fails but direct fetch may still work. */
export async function logSignUpFailureDiagnostics(
  email: string,
  error: unknown,
): Promise<void> {
  const config = getSupabaseConfigSnapshot();
  console.error('[SpeedSpark Supabase] auth.signUp failure diagnostics', {
    email,
    config,
    signUpError: serializeAuthError(error),
    globalFetchType: typeof globalThis.fetch,
  });

  const settings = await fetchAuthSettingsHealth();
  console.error('[SpeedSpark Supabase] auth.signUp — settings fetch after failure', settings);

  if (settings.ok || settings.status > 0) {
    const rawSignUp = await probeRawAuthSignUpFetch();
    console.error('[SpeedSpark Supabase] auth.signUp — raw signup fetch after failure', rawSignUp);
  }
}

async function probeClientSignUp(): Promise<SupabaseConnectionTestResult['clientSignUpProbe']> {
  const client = requireSupabase();
  const probeEmail = `health-check-${Date.now()}@example.com`;
  logSupabaseRequest('health.clientSignUp', { probeEmail });

  const { data, error } = await client.auth.signUp({
    email: probeEmail,
    password: 'HealthCheck1!Aa',
  });

  if (error) {
    console.error('[SpeedSpark Supabase] health.clientSignUp error', serializeAuthError(error));
    return {
      ok: false,
      errorMessage: error.message,
      errorStatus: error.status,
      errorName: error.name,
    };
  }

  console.log('[SpeedSpark Supabase] health.clientSignUp ok', {
    hasUser: Boolean(data.user),
    hasSession: Boolean(data.session),
  });

  return {
    ok: true,
    hasUser: Boolean(data.user),
  };
}

export async function runSupabaseConnectionTest(): Promise<SupabaseConnectionTestResult> {
  logSupabaseUrlDiagnostics('connectionTest');
  const config = getSupabaseConfigSnapshot();
  console.log('[SpeedSpark Supabase] connection test — config', config);

  const settingsFetch = await fetchAuthSettingsHealth();

  let rawSignUpFetch: FetchHealthResult | null = null;
  let clientSignUpProbe: SupabaseConnectionTestResult['clientSignUpProbe'] = null;

  if (settingsFetch.ok || settingsFetch.status > 0) {
    rawSignUpFetch = await probeRawAuthSignUpFetch();
    clientSignUpProbe = await probeClientSignUp();
  }

  const lines: string[] = [
    `Env URL tail: ${config.envUrlTail}`,
    `Host: ${config.urlHost} (${config.urlValid ? 'valid HTTPS' : 'check URL'})`,
    `Key length: ${config.anonKeyLength} (present: ${config.anonKeyPresent})`,
    `Client URL match: ${config.clientReceivesSameUrl ? 'yes' : 'NO'}`,
    `Client key length match: ${config.clientReceivesSameKeyLength ? 'yes' : 'NO'}`,
    `Settings GET: ${settingsFetch.fetchError ?? `${settingsFetch.status} ${settingsFetch.statusText}`}`,
  ];

  if (rawSignUpFetch) {
    lines.push(
      `Raw signup POST: ${rawSignUpFetch.fetchError ?? `${rawSignUpFetch.status} ${rawSignUpFetch.statusText}`}`,
    );
  }

  if (clientSignUpProbe) {
    lines.push(
      clientSignUpProbe.ok
        ? `Client signUp: OK (probe user created — check Auth users)`
        : `Client signUp: ${clientSignUpProbe.errorMessage ?? 'failed'} (status ${clientSignUpProbe.errorStatus ?? 'n/a'})`,
    );
  }

  const summary = lines.join('\n');
  console.log('[SpeedSpark Supabase] connection test summary\n' + summary);

  return {
    config,
    settingsFetch,
    rawSignUpFetch,
    clientSignUpProbe,
    summary,
  };
}
