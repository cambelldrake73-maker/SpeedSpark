import type {
  CallCompleteResult,
  CallNoShowResult,
  CallOrchestrationState,
  CallParticipantJoinedResult,
  CallTokenResponse,
} from '../types/call';
import { logCallError, logCallEvent } from './callLogger';
import { requireSupabase } from './supabase';
import { isSupabaseConfigured } from './supabaseEnv';

async function invokeCallFunction<T>(
  name: 'create-call-room' | 'get-call-token',
  speedDateId: string,
): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new Error('Voice calls require Supabase configuration.');
  }

  const { data, error } = await requireSupabase().functions.invoke(name, {
    body: { speedDateId },
  });

  if (error) {
    throw new Error(error.message ?? `Failed to invoke ${name}`);
  }

  const payload = (data ?? {}) as { ok?: boolean; error?: string };
  if (payload.ok === false || payload.error) {
    throw new Error(payload.error ?? `Failed to invoke ${name}`);
  }

  return data as T;
}

async function invokeCallRpc<T>(fn: string, speedDateId: string): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new Error('Voice calls require Supabase configuration.');
  }

  const { data, error } = await requireSupabase().rpc(fn, {
    p_speed_date_id: speedDateId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? {}) as T;
}

export async function createCallRoom(speedDateId: string): Promise<{ roomName: string }> {
  logCallEvent('room.create.requested', { speedDateId });
  try {
    const result = await invokeCallFunction<{ roomName: string }>('create-call-room', speedDateId);
    logCallEvent('room.created', { speedDateId, roomName: result.roomName });
    return result;
  } catch (error) {
    logCallError('room.failed', error, { speedDateId, stage: 'create-room' });
    throw error;
  }
}

export async function fetchCallToken(speedDateId: string): Promise<CallTokenResponse> {
  logCallEvent('room.token.requested', { speedDateId });
  try {
    const result = await invokeCallFunction<CallTokenResponse>('get-call-token', speedDateId);
    logCallEvent('room.token.issued', {
      speedDateId,
      roomName: result.roomName,
      expiresAt: result.expiresAt,
    });
    return result;
  } catch (error) {
    logCallError('room.token.failed', error, { speedDateId });
    throw error;
  }
}

export async function markCallParticipantJoined(
  speedDateId: string,
): Promise<CallParticipantJoinedResult> {
  logCallEvent('participant.joined.rpc', { speedDateId });
  try {
    const result = await invokeCallRpc<CallParticipantJoinedResult>(
      'mark_call_participant_joined',
      speedDateId,
    );
    if (result.bothJoined) {
      logCallEvent('both.joined', { speedDateId, bothJoinedAt: result.bothJoinedAt });
    }
    return result;
  } catch (error) {
    logCallError('participant.joined.failed', error, { speedDateId });
    throw error;
  }
}

export async function markCallParticipantLeft(speedDateId: string): Promise<CallOrchestrationState> {
  logCallEvent('participant.left.rpc', { speedDateId });
  try {
    return await invokeCallRpc<CallOrchestrationState>('mark_call_participant_left', speedDateId);
  } catch (error) {
    logCallError('participant.left.failed', error, { speedDateId });
    throw error;
  }
}

export async function fetchCallOrchestrationState(
  speedDateId: string,
): Promise<CallOrchestrationState> {
  return invokeCallRpc<CallOrchestrationState>('get_call_orchestration_state', speedDateId);
}

export async function cancelCallNoShow(speedDateId: string): Promise<CallNoShowResult> {
  logCallEvent('no_show.cancel.requested', { speedDateId });
  try {
    const result = await invokeCallRpc<CallNoShowResult>('cancel_call_no_show', speedDateId);
    logCallEvent('no_show.cancelled', {
      speedDateId,
      noShowUserId: result.noShowUserId,
      returnedToQueueUserId: result.returnedToQueueUserId,
    });
    return result;
  } catch (error) {
    logCallError('no_show.cancel.failed', error, { speedDateId });
    throw error;
  }
}

export async function completeCallIfValid(speedDateId: string): Promise<CallCompleteResult> {
  logCallEvent('complete.requested', { speedDateId });
  try {
    const result = await invokeCallRpc<CallCompleteResult>('complete_call_if_valid', speedDateId);
    if (result.ok) {
      logCallEvent('completed', { speedDateId, bothJoinedAt: result.bothJoinedAt });
    }
    return result;
  } catch (error) {
    logCallError('complete.failed', error, { speedDateId });
    throw error;
  }
}

/** @deprecated Prefer completeCallIfValid — validates both-join before completing. */
export async function completeSpeedDateCall(speedDateId: string): Promise<void> {
  await completeCallIfValid(speedDateId);
}

export async function cancelSpeedDateCall(speedDateId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('cancel_speed_date_call', {
    p_speed_date_id: speedDateId,
  });
  if (error) {
    throw new Error(error.message);
  }
}
