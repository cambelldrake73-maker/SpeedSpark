import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { isDbAvailable, resolveDbClient } from './dbClient';

/** IDs this user blocked or is blocked by (for matching). */
export async function fetchBlockedUserIds(userId: string): Promise<Set<string>> {
  if (!isDbAvailable()) {
    return new Set();
  }

  const op = 'blocked_users.selectIdsForMatching';
  logSupabaseRequest(op, { userId });

  const { data, error } = await resolveDbClient()
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  if (error) {
    throwSupabaseError(op, error);
  }

  const ids = new Set<string>();
  for (const row of (data ?? []) as Array<{ blocker_id: string; blocked_id: string }>) {
    if (row.blocker_id === userId) {
      ids.add(row.blocked_id);
    } else {
      ids.add(row.blocker_id);
    }
  }
  return ids;
}
