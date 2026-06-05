import type { RealtimeChannel } from '@supabase/supabase-js';
import type { QueueCounts, SpeedDateRecord } from '../types/matchingBackend';
import { logBackendInfo } from './backendLogger';
import { getQueueCounts } from './queueService';
import { isSupabaseConfigured, requireSupabase } from './supabase';

export type QueueRealtimePayload = {
  windowId: string;
  counts: QueueCounts;
  eventType: string;
};

export type SpeedDateRealtimePayload = {
  speedDate: SpeedDateRecord;
  eventType: string;
};

function mapSpeedDateRow(row: Record<string, unknown>): SpeedDateRecord {
  return {
    id: row.id as string,
    windowId: (row.window_id as string | null) ?? null,
    userAId: row.user_a_id as string,
    userBId: row.user_b_id as string,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string | null) ?? null,
    status: row.status as SpeedDateRecord['status'],
  };
}

export function subscribeToQueueWindow(
  windowId: string,
  onUpdate: (payload: QueueRealtimePayload) => void,
): (() => void) | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  const client = requireSupabase();
  const channelName = `queue-window-${windowId}`;

  const refresh = async (eventType: string) => {
    const counts = await getQueueCounts(windowId);
    onUpdate({ windowId, counts, eventType });
  };

  const channel: RealtimeChannel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'queue_entries',
        filter: `window_id=eq.${windowId}`,
      },
      (payload) => {
        logBackendInfo('realtime.queue', { windowId, event: payload.eventType });
        void refresh(payload.eventType);
      },
    )
    .subscribe((status) => {
      logBackendInfo('realtime.queue.subscribe', { windowId, status });
      if (status === 'SUBSCRIBED') {
        void refresh('SUBSCRIBED');
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToSpeedDatesForUser(
  userId: string,
  onUpdate: (payload: SpeedDateRealtimePayload) => void,
): (() => void) | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  const client = requireSupabase();
  const channelName = `speed-dates-user-${userId}`;

  const channel: RealtimeChannel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'speed_dates',
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | undefined;
        if (!row) {
          return;
        }
        const record = mapSpeedDateRow(row);
        if (record.userAId !== userId && record.userBId !== userId) {
          return;
        }
        logBackendInfo('realtime.speedDate', {
          userId,
          event: payload.eventType,
          speedDateId: record.id,
        });
        onUpdate({ speedDate: record, eventType: payload.eventType });
      },
    )
    .subscribe((status) => {
      logBackendInfo('realtime.speedDate.subscribe', { userId, status });
    });

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToMatchesForUser(
  userId: string,
  onUpdate: (eventType: string) => void,
): (() => void) | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  const client = requireSupabase();
  const channelName = `matches-user-${userId}`;

  const channel: RealtimeChannel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'matches',
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | undefined;
        if (!row) {
          return;
        }
        const userA = row.user_a_id as string;
        const userB = row.user_b_id as string;
        if (userA !== userId && userB !== userId) {
          return;
        }
        logBackendInfo('realtime.match', { userId, event: payload.eventType });
        onUpdate(payload.eventType);
      },
    )
    .subscribe((status) => {
      logBackendInfo('realtime.match.subscribe', { userId, status });
    });

  return () => {
    void client.removeChannel(channel);
  };
}
