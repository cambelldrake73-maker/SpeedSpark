import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Message } from '../types';
import type { QueueCounts, SpeedDateRecord } from '../types/matchingBackend';
import { logBackendInfo } from './backendLogger';
import { getQueueCounts } from './queueService';
import { isSupabaseConfigured, requireSupabase } from './supabase';

interface MessageRow {
  id: string;
  match_id: string;
  sender_id: string;
  text: string;
  sent_at: string;
}

function mapMessageRow(row: MessageRow): Message {
  return {
    id: row.id,
    matchId: row.match_id,
    senderId: row.sender_id,
    text: row.text,
    sentAt: row.sent_at,
  };
}

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

export type FeedbackRealtimePayload = {
  speedDateId: string;
  eventType: string;
};

export function subscribeToFeedbackForSpeedDate(
  speedDateId: string,
  onUpdate: (payload: FeedbackRealtimePayload) => void,
): (() => void) | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  const client = requireSupabase();
  const channelName = `date-feedback-${speedDateId}`;

  const channel: RealtimeChannel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'date_feedback',
        filter: `speed_date_id=eq.${speedDateId}`,
      },
      (payload) => {
        logBackendInfo('realtime.feedback', {
          speedDateId,
          event: payload.eventType,
        });
        onUpdate({ speedDateId, eventType: payload.eventType });
      },
    )
    .subscribe((status) => {
      logBackendInfo('realtime.feedback.subscribe', { speedDateId, status });
    });

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToMatchMessages(
  matchId: string,
  onMessage: (message: Message, eventType: string) => void,
): (() => void) | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  const client = requireSupabase();
  const channelName = `messages-match-${matchId}`;

  const channel: RealtimeChannel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => {
        const row = payload.new as MessageRow | undefined;
        if (!row) {
          return;
        }
        logBackendInfo('realtime.message', { matchId, messageId: row.id });
        onMessage(mapMessageRow(row), payload.eventType);
      },
    )
    .subscribe((status) => {
      logBackendInfo('realtime.message.subscribe', { matchId, status });
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
