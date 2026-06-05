import type { DateFeedback } from '../types';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { logBackendInfo } from './backendLogger';
import { subscribeToFeedbackForSpeedDate } from './realtimeSubscriptions';
import { isSupabaseConfigured, requireSupabase } from './supabase';

export { subscribeToFeedbackForSpeedDate };

export type SpeedDateMatchStatus =
  | 'pending_self'
  | 'waiting'
  | 'no_match'
  | 'mutual_match';

export interface DateFeedbackRecord {
  id: string;
  speedDateId: string;
  raterId: string;
  partnerId: string;
  attractivenessRating: number;
  wouldTalkAgain: boolean;
  createdAt: string;
}

export interface SpeedDateMatchResult {
  status: SpeedDateMatchStatus;
  myFeedbackSubmitted: boolean;
  myWouldTalkAgain: boolean | null;
  partnerFeedbackSubmitted: boolean;
  /** Only yes/no — attractiveness is never exposed to the other user. */
  partnerWouldTalkAgain: boolean | null;
  isMutualMatch: boolean;
  matchId: string | null;
  blocked: boolean;
  reported: boolean;
}

interface DateFeedbackRow {
  id: string;
  speed_date_id: string;
  rater_id: string;
  partner_id: string;
  attractiveness_rating: number;
  would_talk_again: boolean;
  created_at: string;
}

function mapFeedbackRow(row: DateFeedbackRow): DateFeedbackRecord {
  return {
    id: row.id,
    speedDateId: row.speed_date_id,
    raterId: row.rater_id,
    partnerId: row.partner_id,
    attractivenessRating: row.attractiveness_rating,
    wouldTalkAgain: row.would_talk_again,
    createdAt: row.created_at,
  };
}

function mapMatchResult(payload: Record<string, unknown>): SpeedDateMatchResult {
  return {
    status: payload.status as SpeedDateMatchStatus,
    myFeedbackSubmitted: Boolean(payload.myFeedbackSubmitted),
    myWouldTalkAgain:
      payload.myWouldTalkAgain === null || payload.myWouldTalkAgain === undefined
        ? null
        : Boolean(payload.myWouldTalkAgain),
    partnerFeedbackSubmitted: Boolean(payload.partnerFeedbackSubmitted),
    partnerWouldTalkAgain:
      payload.partnerWouldTalkAgain === null || payload.partnerWouldTalkAgain === undefined
        ? null
        : Boolean(payload.partnerWouldTalkAgain),
    isMutualMatch: Boolean(payload.isMutualMatch),
    matchId: (payload.matchId as string | null) ?? null,
    blocked: Boolean(payload.blocked),
    reported: Boolean(payload.reported),
  };
}

export async function fetchFeedbackForSpeedDate(
  speedDateId: string,
  userId: string,
): Promise<DateFeedbackRecord | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const op = 'date_feedback.selectOwn';
  logSupabaseRequest(op, { speedDateId, userId });

  const { data, error } = await requireSupabase()
    .from('date_feedback')
    .select('*')
    .eq('speed_date_id', speedDateId)
    .eq('rater_id', userId)
    .maybeSingle();

  if (error) {
    throwSupabaseError(op, error);
  }

  if (!data) {
    return null;
  }

  return mapFeedbackRow(data as DateFeedbackRow);
}

export async function fetchSpeedDateMatchResult(
  speedDateId: string,
): Promise<SpeedDateMatchResult> {
  const op = 'rpc.get_speed_date_match_result';
  logSupabaseRequest(op, { speedDateId });

  const { data, error } = await requireSupabase().rpc('get_speed_date_match_result', {
    p_speed_date_id: speedDateId,
  });

  if (error) {
    throwSupabaseError(op, error);
  }

  return mapMatchResult((data ?? {}) as Record<string, unknown>);
}

export interface SubmitDateFeedbackResult {
  feedback: DateFeedback;
  matchResult: SpeedDateMatchResult;
}

export async function submitDateFeedback(
  userId: string,
  speedDateId: string,
  partnerId: string,
  attractivenessRating: number,
  wouldTalkAgain: boolean,
): Promise<SubmitDateFeedbackResult> {
  const op = 'rpc.submit_date_feedback_and_resolve';
  logSupabaseRequest(op, { userId, speedDateId, partnerId, wouldTalkAgain });

  const { data, error } = await requireSupabase().rpc('submit_date_feedback_and_resolve', {
    p_speed_date_id: speedDateId,
    p_partner_id: partnerId,
    p_attractiveness_rating: attractivenessRating,
    p_would_talk_again: wouldTalkAgain,
  });

  if (error) {
    throwSupabaseError(op, error);
  }

  const matchResult = mapMatchResult((data ?? {}) as Record<string, unknown>);

  logBackendInfo('feedback.submitted', {
    speedDateId,
    userId,
    wouldTalkAgain,
    status: matchResult.status,
  });

  if (matchResult.partnerFeedbackSubmitted) {
    logBackendInfo('feedback.partnerFound', {
      speedDateId,
      partnerWouldTalkAgain: matchResult.partnerWouldTalkAgain,
    });
  } else {
    logBackendInfo('feedback.partnerNotFound', { speedDateId });
  }

  if (matchResult.isMutualMatch && matchResult.matchId) {
    logBackendInfo('feedback.mutualMatch', { speedDateId, matchId: matchResult.matchId });
  } else if (matchResult.status === 'no_match') {
    logBackendInfo('feedback.noMatch', {
      speedDateId,
      myWouldTalkAgain: matchResult.myWouldTalkAgain,
      partnerWouldTalkAgain: matchResult.partnerWouldTalkAgain,
      blocked: matchResult.blocked,
      reported: matchResult.reported,
    });
  }

  const feedback: DateFeedback = {
    dateId: speedDateId,
    partnerId,
    attractivenessRating,
    wouldTalkAgain,
  };

  return { feedback, matchResult };
}
