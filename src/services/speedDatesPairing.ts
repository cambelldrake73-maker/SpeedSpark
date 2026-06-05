import type { SpeedDateRecord } from '../types/matchingBackend';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { isDbAvailable, resolveDbClient } from './dbClient';
import { logBackendInfo } from './backendLogger';

export async function applyQueuePair(
  windowId: string,
  userAId: string,
  userBId: string,
): Promise<string> {
  const op = 'rpc.apply_queue_pair';
  logSupabaseRequest(op, { windowId, userAId, userBId });

  const { data, error } = await resolveDbClient().rpc('apply_queue_pair', {
    p_window_id: windowId,
    p_user_a_id: userAId,
    p_user_b_id: userBId,
  });

  if (error) {
    throwSupabaseError(op, error);
  }

  const speedDateId = data as string;
  logBackendInfo('speedDates.pairCreated', { windowId, userAId, userBId, speedDateId });
  return speedDateId;
}

function pairKey(userAId: string, userBId: string): string {
  return [userAId, userBId].sort().join(':');
}

/** Recent speed-date pair keys (sorted user ids) within the lookback window. */
export async function fetchRecentSpeedDatePairKeys(
  userIds: string[],
  withinDays = 14,
): Promise<Set<string>> {
  if (!isDbAvailable() || userIds.length < 2) {
    return new Set();
  }

  const since = new Date();
  since.setDate(since.getDate() - withinDays);
  const op = 'speed_dates.selectRecentPairs';
  logSupabaseRequest(op, { userCount: userIds.length, withinDays });

  const orFilter = userIds.map((id) => `user_a_id.eq.${id},user_b_id.eq.${id}`).join(',');
  const { data, error } = await resolveDbClient()
    .from('speed_dates')
    .select('user_a_id, user_b_id, started_at')
    .or(orFilter)
    .gte('started_at', since.toISOString());

  if (error) {
    throwSupabaseError(op, error);
  }

  const keys = new Set<string>();
  for (const row of (data ?? []) as Array<{ user_a_id: string; user_b_id: string }>) {
    if (userIds.includes(row.user_a_id) && userIds.includes(row.user_b_id)) {
      keys.add(pairKey(row.user_a_id, row.user_b_id));
    }
  }

  return keys;
}

export type { SpeedDateRecord };
