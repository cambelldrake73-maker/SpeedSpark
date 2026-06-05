import type { SpeedDateRecord, SpeedDateStatus } from '../types/matchingBackend';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { isSupabaseConfigured, requireSupabase } from './supabase';
import { logBackendInfo } from './backendLogger';

interface SpeedDateRow {
  id: string;
  window_id: string | null;
  user_a_id: string;
  user_b_id: string;
  started_at: string;
  ended_at: string | null;
  status: SpeedDateStatus;
}

function mapSpeedDate(row: SpeedDateRow): SpeedDateRecord {
  return {
    id: row.id,
    windowId: row.window_id,
    userAId: row.user_a_id,
    userBId: row.user_b_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
  };
}

export { applyQueuePair } from './speedDatesPairing';

export async function fetchActiveSpeedDateForUser(
  userId: string,
): Promise<SpeedDateRecord | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const op = 'speed_dates.selectActiveForUser';
  logSupabaseRequest(op, { userId });

  const { data, error } = await requireSupabase()
    .from('speed_dates')
    .select('*')
    .eq('status', 'active')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throwSupabaseError(op, error);
  }

  if (!data) {
    return null;
  }

  return mapSpeedDate(data as SpeedDateRow);
}

export async function fetchSpeedDatesForWindow(windowId: string): Promise<SpeedDateRecord[]> {
  const op = 'speed_dates.selectForWindow';
  logSupabaseRequest(op, { windowId });

  const { data, error } = await requireSupabase()
    .from('speed_dates')
    .select('*')
    .eq('window_id', windowId)
    .order('started_at', { ascending: false });

  if (error) {
    throwSupabaseError(op, error);
  }

  return ((data ?? []) as SpeedDateRow[]).map(mapSpeedDate);
}

export { fetchRecentSpeedDatePairKeys } from './speedDatesPairing';

export async function updateSpeedDateStatus(
  speedDateId: string,
  status: SpeedDateStatus,
  endedAt?: string,
): Promise<void> {
  const op = 'speed_dates.updateStatus';
  logSupabaseRequest(op, { speedDateId, status });

  const { error } = await requireSupabase()
    .from('speed_dates')
    .update({
      status,
      ended_at: endedAt ?? new Date().toISOString(),
    })
    .eq('id', speedDateId);

  if (error) {
    throwSupabaseError(op, error);
  }
}
