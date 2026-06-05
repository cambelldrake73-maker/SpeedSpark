import { PAIRING_LOCK_TTL_SECONDS } from '../constants/autoPairing';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { isDbAvailable, resolveDbClient } from './dbClient';
import { logBackendInfo } from './backendLogger';

export type PairingTriggerSource = 'client_worker' | 'edge_function' | 'dev_console';

let clientWorkerSessionId: string | null = null;

export function pairingWorkerId(source: PairingTriggerSource): string {
  if (source === 'edge_function') {
    return 'edge:pair-live-windows';
  }
  if (source === 'dev_console') {
    return 'dev:matching-console';
  }
  if (!clientWorkerSessionId) {
    clientWorkerSessionId = `client:${Math.random().toString(36).slice(2, 10)}`;
  }
  return clientWorkerSessionId;
}

export async function tryAcquirePairingLock(
  windowId: string,
  workerId: string,
  ttlSeconds = PAIRING_LOCK_TTL_SECONDS,
): Promise<boolean> {
  if (!isDbAvailable()) {
    return true;
  }

  const op = 'rpc.try_acquire_pairing_lock';
  logSupabaseRequest(op, { windowId, workerId, ttlSeconds });

  const { data, error } = await resolveDbClient().rpc('try_acquire_pairing_lock', {
    p_window_id: windowId,
    p_worker_id: workerId,
    p_ttl_seconds: ttlSeconds,
  });

  if (error) {
    throwSupabaseError(op, error);
  }

  const acquired = Boolean(data);
  logBackendInfo('pairing.lock', { windowId, workerId, acquired });
  return acquired;
}

export async function releasePairingLock(windowId: string, workerId: string): Promise<void> {
  if (!isDbAvailable()) {
    return;
  }

  const op = 'rpc.release_pairing_lock';
  logSupabaseRequest(op, { windowId, workerId });

  const { error } = await resolveDbClient().rpc('release_pairing_lock', {
    p_window_id: windowId,
    p_worker_id: workerId,
  });

  if (error) {
    throwSupabaseError(op, error);
  }

  logBackendInfo('pairing.lockReleased', { windowId, workerId });
}
