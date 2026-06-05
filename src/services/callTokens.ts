import type { CallTokenResponse } from '../types/call';
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

export async function completeSpeedDateCall(speedDateId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('complete_speed_date_call', {
    p_speed_date_id: speedDateId,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function cancelSpeedDateCall(speedDateId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('cancel_speed_date_call', {
    p_speed_date_id: speedDateId,
  });
  if (error) {
    throw new Error(error.message);
  }
}
