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
  planRuns?: Array<{
    windowId: string;
    candidatesConsidered: number;
    reservationsCreated: number;
    immediateCommits?: number;
    waitingCandidates?: number;
    availableSoonCandidates?: number;
    reservationIds: string[];
    unmatched: number;
    skipped: number;
    skippedLock?: boolean;
  }>;
  commitResult?: {
    ok: boolean;
    reservationId?: string;
    speedDateId?: string;
    windowId?: string;
    userAId?: string;
    userBId?: string;
    error?: string;
    reasonCode?: string;
    userId?: string;
  };
  seedSpeedDateResult?: {
    ok: boolean;
    speedDateId?: string;
    error?: string;
  };
  endSpeedDateResult?: {
    ok: boolean;
    speedDateId?: string;
    windowId?: string;
    userAId?: string;
    userBId?: string;
    error?: string;
  };
  orchestrationReport?: Record<string, unknown>;
  reservationMetrics?: Record<string, unknown>;
  expiredCount?: number;
  reservations?: Array<Record<string, unknown>>;
  error?: string;
}

/** Invokes the server-side pairing Edge Function (trusted matching context). */
export async function invokeServerPairing(options?: {
  windowId?: string;
  mode?: 'pair' | 'plan';
  action?: 'commit' | 'expire' | 'report' | 'seedActiveDate' | 'endSpeedDate' | 'orchestrationReport' | 'reservationMetrics';
  reservationId?: string;
  speedDateId?: string;
  userAId?: string;
  userBId?: string;
  secondsRemaining?: number;
}): Promise<InvokePairingResponse> {
  const headers: Record<string, string> = {};
  if (PAIRING_INVOKE_SECRET) {
    headers['x-pairing-secret'] = PAIRING_INVOKE_SECRET;
  }

  logBackendInfo('pairing.remote.invoke', {
    windowId: options?.windowId ?? 'all-live',
    mode: options?.mode ?? 'pair',
    action: options?.action,
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
