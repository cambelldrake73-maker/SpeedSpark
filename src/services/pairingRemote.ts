import { logBackendInfo } from './backendLogger';
import { requireSupabase } from './supabase';
import { PAIRING_INVOKE_SECRET } from './supabaseEnv';

export interface InvokePairingResponse {
  ok: boolean;
  windowsScanned?: number;
  totalPairsCreated?: number;
  runs?: Array<{
    windowId: string;
    candidatesConsidered: number;
    pairsCreated: number;
    unmatched: number;
    skipped: number;
    skippedLock?: boolean;
  }>;
  error?: string;
}

/** Invokes the server-side pairing Edge Function (trusted matching context). */
export async function invokeServerPairing(options?: {
  windowId?: string;
}): Promise<InvokePairingResponse> {
  const headers: Record<string, string> = {};
  if (PAIRING_INVOKE_SECRET) {
    headers['x-pairing-secret'] = PAIRING_INVOKE_SECRET;
  }

  logBackendInfo('pairing.remote.invoke', {
    windowId: options?.windowId ?? 'all-live',
    hasSecret: Boolean(PAIRING_INVOKE_SECRET),
  });

  const { data, error } = await requireSupabase().functions.invoke('pair-live-windows', {
    body: options ?? {},
    headers,
  });

  if (error) {
    const message = error.message ?? String(error);
    logBackendInfo('pairing.remote.error', { message });
    return { ok: false, error: message };
  }

  const response = (data ?? {}) as InvokePairingResponse;
  logBackendInfo('pairing.remote.done', {
    ok: response.ok,
    totalPairsCreated: response.totalPairsCreated ?? 0,
    windowsScanned: response.windowsScanned ?? 0,
  });
  return response;
}
