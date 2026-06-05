import type { QueueCounts, QueueEntry, QueueStatusResult } from '../types/matchingBackend';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { logBackendError, logQueueEvent } from './backendLogger';
import { isSupabaseConfigured, requireSupabase } from './supabase';

interface QueueEntryRow {
  id: string;
  window_id: string;
  user_id: string;
  status: 'waiting' | 'paired' | 'left';
  joined_at: string;
}

function mapQueueEntry(row: QueueEntryRow): QueueEntry {
  return {
    id: row.id,
    windowId: row.window_id,
    userId: row.user_id,
    status: row.status,
    joinedAt: row.joined_at,
  };
}

export async function getQueueCounts(windowId: string): Promise<QueueCounts> {
  if (!isSupabaseConfigured) {
    return { windowId, waiting: 0, paired: 0, left: 0, total: 0 };
  }

  const op = 'queue_entries.counts';
  logSupabaseRequest(op, { windowId });

  const { data, error } = await requireSupabase()
    .from('queue_entries')
    .select('status')
    .eq('window_id', windowId);

  if (error) {
    throwSupabaseError(op, error);
  }

  const rows = (data ?? []) as Array<{ status: QueueEntryRow['status'] }>;
  const waiting = rows.filter((r) => r.status === 'waiting').length;
  const paired = rows.filter((r) => r.status === 'paired').length;
  const left = rows.filter((r) => r.status === 'left').length;

  return {
    windowId,
    waiting,
    paired,
    left,
    total: rows.length,
  };
}

export async function getWaitingQueueEntries(windowId: string): Promise<QueueEntry[]> {
  const op = 'queue_entries.selectWaiting';
  logSupabaseRequest(op, { windowId });

  const { data, error } = await requireSupabase()
    .from('queue_entries')
    .select('*')
    .eq('window_id', windowId)
    .eq('status', 'waiting')
    .order('joined_at', { ascending: true });

  if (error) {
    throwSupabaseError(op, error);
  }

  return ((data ?? []) as QueueEntryRow[]).map(mapQueueEntry);
}

export async function getQueueStatus(
  userId: string,
  windowId: string,
): Promise<QueueStatusResult> {
  if (!isSupabaseConfigured) {
    return { inQueue: false, entry: null };
  }

  const op = 'queue_entries.selectForUser';
  logSupabaseRequest(op, { userId, windowId });

  const { data, error } = await requireSupabase()
    .from('queue_entries')
    .select('*')
    .eq('window_id', windowId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throwSupabaseError(op, error);
  }

  if (!data) {
    return { inQueue: false, entry: null };
  }

  const entry = mapQueueEntry(data as QueueEntryRow);
  return {
    inQueue: entry.status === 'waiting',
    entry,
  };
}

export async function joinQueue(userId: string, windowId: string): Promise<QueueEntry> {
  if (userId.trim().length === 0) {
    throw new Error('User id is required to join the queue.');
  }

  if (!isSupabaseConfigured) {
    throw new Error('Queue is only available when the account server is configured.');
  }

  const existing = await getQueueStatus(userId, windowId);
  if (existing.entry?.status === 'waiting') {
    logQueueEvent('join', { userId, windowId, duplicate: true });
    return existing.entry;
  }

  if (existing.entry?.status === 'paired') {
    throw new Error('You are already paired in this window.');
  }

  const op = 'queue_entries.upsertJoin';
  logSupabaseRequest(op, { userId, windowId });

  const { data, error } = await requireSupabase()
    .from('queue_entries')
    .upsert(
      {
        window_id: windowId,
        user_id: userId,
        status: 'waiting',
        joined_at: new Date().toISOString(),
      },
      { onConflict: 'window_id,user_id' },
    )
    .select('*')
    .single();

  if (error) {
    logBackendError('queue.join.failed', error, { userId, windowId });
    throwSupabaseError(op, error);
  }

  const entry = mapQueueEntry(data as QueueEntryRow);
  logQueueEvent('join', { userId, windowId, entryId: entry.id });
  return entry;
}

export async function leaveQueue(userId: string, windowId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  const op = 'queue_entries.leave';
  logSupabaseRequest(op, { userId, windowId });

  const { error } = await requireSupabase()
    .from('queue_entries')
    .update({ status: 'left' })
    .eq('window_id', windowId)
    .eq('user_id', userId)
    .in('status', ['waiting', 'paired']);

  if (error) {
    logBackendError('queue.leave.failed', error, { userId, windowId });
    throwSupabaseError(op, error);
  }

  logQueueEvent('leave', { userId, windowId });
}
