import type { BlockedUser } from '../types';
import {
  logSupabaseRequest,
  throwSupabaseError,
} from '../utils/supabaseDebug';
import { isSupabaseConfigured, requireSupabase } from './supabase';
import { fetchProfile } from './profiles';

export async function fetchBlockedUsers(blockerId: string): Promise<BlockedUser[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const op = 'blocked_users.select';
  logSupabaseRequest(op, { blockerId });

  const { data, error } = await requireSupabase()
    .from('blocked_users')
    .select('blocked_id, created_at')
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false });

  if (error) {
    throwSupabaseError(op, error);
  }

  const rows = (data ?? []) as Array<{ blocked_id: string; created_at: string }>;
  const blockedUsers = await Promise.all(
    rows.map(async (row) => {
      const profile = await fetchProfile(row.blocked_id);
      return {
        userId: row.blocked_id,
        name: profile?.name ?? 'Blocked user',
        blockedAt: row.created_at,
      };
    }),
  );

  console.log('[SpeedSpark Supabase] ✓ blocked_users.select', {
    blockerId,
    count: blockedUsers.length,
  });
  return blockedUsers;
}

/** IDs this user blocked or is blocked by (for matching). */
export async function fetchBlockedUserIds(userId: string): Promise<Set<string>> {
  if (!isSupabaseConfigured) {
    return new Set();
  }

  const op = 'blocked_users.selectIdsForMatching';
  logSupabaseRequest(op, { userId });

  const { data, error } = await requireSupabase()
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

export async function blockUserInSupabase(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  const op = 'blocked_users.upsert';
  logSupabaseRequest(op, { blockerId, blockedId });

  const { error } = await requireSupabase().from('blocked_users').upsert(
    {
      blocker_id: blockerId,
      blocked_id: blockedId,
    },
    { onConflict: 'blocker_id,blocked_id' },
  );

  if (error) {
    throwSupabaseError(op, error);
  }

  console.log('[SpeedSpark Supabase] ✓ blocked_users.upsert', { blockerId, blockedId });
}

export async function unblockUserInSupabase(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  const op = 'blocked_users.delete';
  logSupabaseRequest(op, { blockerId, blockedId });

  const { error } = await requireSupabase()
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  if (error) {
    throwSupabaseError(op, error);
  }

  console.log('[SpeedSpark Supabase] ✓ blocked_users.delete', { blockerId, blockedId });
}

export async function createReport(input: {
  reporterId: string;
  reportedId: string;
  context: 'call' | 'messages' | 'profile';
  speedDateId?: string;
  notes?: string;
}): Promise<void> {
  const op = 'reports.insert';
  logSupabaseRequest(op, {
    reporterId: input.reporterId,
    reportedId: input.reportedId,
    context: input.context,
  });

  const { error } = await requireSupabase().from('reports').insert({
    reporter_id: input.reporterId,
    reported_id: input.reportedId,
    context: input.context,
    speed_date_id: input.speedDateId ?? null,
    notes: input.notes ?? null,
  });

  if (error) {
    throwSupabaseError(op, error);
  }

  console.log('[SpeedSpark Supabase] ✓ reports.insert');
}
