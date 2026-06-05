import type { Match, Message } from '../types';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { logBackendInfo } from './backendLogger';
import { fetchProfile } from './profiles';
import { isSupabaseConfigured, requireSupabase } from './supabase';

export { subscribeToMatchMessages, subscribeToMatchesForUser as subscribeToUserMatches } from './realtimeSubscriptions';

interface MatchRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  speed_date_id: string | null;
  matched_at: string;
  last_message_at: string | null;
}

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

function partnerIdForMatch(row: MatchRow, userId: string): string {
  return row.user_a_id === userId ? row.user_b_id : row.user_a_id;
}

async function fetchLatestMessage(matchId: string): Promise<Message | null> {
  const op = 'messages.selectLatest';
  logSupabaseRequest(op, { matchId });

  const { data, error } = await requireSupabase()
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throwSupabaseError(op, error);
  }

  return data ? mapMessageRow(data as MessageRow) : null;
}

async function mapMatchRow(row: MatchRow, userId: string): Promise<Match | null> {
  const partnerId = partnerIdForMatch(row, userId);
  const partner = await fetchProfile(partnerId);
  if (!partner) {
    return null;
  }

  const latest = await fetchLatestMessage(row.id);

  return {
    id: row.id,
    user: partner,
    matchedAt: row.matched_at,
    lastMessage: latest?.text,
    lastMessageAt: row.last_message_at ?? latest?.sentAt,
  };
}

export async function fetchUserMatches(userId: string): Promise<Match[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const op = 'matches.selectForUser';
  logSupabaseRequest(op, { userId });

  const { data, error } = await requireSupabase()
    .from('matches')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order('matched_at', { ascending: false });

  if (error) {
    throwSupabaseError(op, error);
  }

  const rows = (data ?? []) as MatchRow[];
  const matches = (
    await Promise.all(rows.map((row) => mapMatchRow(row, userId)))
  ).filter((match): match is Match => match !== null);

  matches.sort((a, b) => {
    const aTime = a.lastMessageAt ?? a.matchedAt;
    const bTime = b.lastMessageAt ?? b.matchedAt;
    return bTime.localeCompare(aTime);
  });

  logBackendInfo('messages.matchesLoaded', { userId, count: matches.length });
  return matches;
}

export async function fetchMatchById(matchId: string, userId: string): Promise<Match | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const op = 'matches.selectById';
  logSupabaseRequest(op, { matchId, userId });

  const { data, error } = await requireSupabase()
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (error) {
    throwSupabaseError(op, error);
  }

  if (!data) {
    return null;
  }

  const row = data as MatchRow;
  if (row.user_a_id !== userId && row.user_b_id !== userId) {
    return null;
  }

  return mapMatchRow(row, userId);
}

export async function fetchMatchThread(matchId: string, userId: string): Promise<Message[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const match = await fetchMatchById(matchId, userId);
  if (!match) {
    throw new Error('You do not have access to this conversation.');
  }

  const op = 'messages.selectThread';
  logSupabaseRequest(op, { matchId, userId });

  const { data, error } = await requireSupabase()
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('sent_at', { ascending: true });

  if (error) {
    throwSupabaseError(op, error);
  }

  const messages = ((data ?? []) as MessageRow[]).map(mapMessageRow);
  logBackendInfo('messages.threadLoaded', { matchId, count: messages.length });
  return messages;
}

export async function sendMessage(
  userId: string,
  matchId: string,
  text: string,
): Promise<Message> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty.');
  }

  const { assertAccountCanParticipate } = await import('./accountSafety');
  await assertAccountCanParticipate(userId);

  const match = await fetchMatchById(matchId, userId);
  if (!match) {
    throw new Error('You do not have access to this conversation.');
  }

  const op = 'messages.insert';
  logSupabaseRequest(op, { matchId, userId });

  const { data, error } = await requireSupabase()
    .from('messages')
    .insert({
      match_id: matchId,
      sender_id: userId,
      text: trimmed,
    })
    .select('*')
    .single();

  if (error) {
    throwSupabaseError(op, error);
  }

  const message = mapMessageRow(data as MessageRow);
  const sentAt = message.sentAt;

  const updateOp = 'matches.updateLastMessageAt';
  logSupabaseRequest(updateOp, { matchId });
  const { error: updateError } = await requireSupabase()
    .from('matches')
    .update({ last_message_at: sentAt })
    .eq('id', matchId);

  if (updateError) {
    throwSupabaseError(updateOp, updateError);
  }

  logBackendInfo('messages.sent', { matchId, messageId: message.id });
  return message;
}

export function mergeMessages(existing: Message[], incoming: Message): Message[] {
  if (existing.some((message) => message.id === incoming.id)) {
    return existing;
  }
  return [...existing, incoming].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}
