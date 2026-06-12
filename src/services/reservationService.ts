import { RESERVATION_TTL_SECONDS } from '../constants/reservations';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { logBackendError, logBackendInfo } from './backendLogger';
import { isDbAvailable, resolveDbClient } from './dbClient';

export type PairReservationStatus = 'pending' | 'committed' | 'expired' | 'cancelled';

export interface PairReservation {
  id: string;
  windowId: string;
  userAId: string;
  userBId: string;
  status: PairReservationStatus;
  mutualScore: number | null;
  planSnapshot: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  committedAt: string | null;
  speedDateId: string | null;
}

export interface CreatePairReservationInput {
  windowId: string;
  userAId: string;
  userBId: string;
  mutualScore?: number;
  planSnapshot?: Record<string, unknown>;
  ttlSeconds?: number;
}

export interface ReservationCommitResult {
  ok: boolean;
  reservationId?: string;
  speedDateId?: string;
  windowId?: string;
  userAId?: string;
  userBId?: string;
  error?: string;
  reasonCode?: string;
  userId?: string;
}

export interface ReservationCancelResult {
  ok: boolean;
  reservationId?: string;
  error?: string;
}

interface PairReservationRow {
  id: string;
  window_id: string;
  user_a_id: string;
  user_b_id: string;
  status: PairReservationStatus;
  mutual_score: number | null;
  plan_snapshot: Record<string, unknown>;
  created_at: string;
  expires_at: string;
  committed_at: string | null;
  speed_date_id: string | null;
}

function mapReservationRow(row: PairReservationRow): PairReservation {
  return {
    id: row.id,
    windowId: row.window_id,
    userAId: row.user_a_id,
    userBId: row.user_b_id,
    status: row.status,
    mutualScore: row.mutual_score,
    planSnapshot: row.plan_snapshot ?? {},
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    committedAt: row.committed_at,
    speedDateId: row.speed_date_id,
  };
}

export async function createPairReservation(
  input: CreatePairReservationInput,
): Promise<PairReservation> {
  const op = 'rpc.create_pair_reservation';
  logSupabaseRequest(op, {
    windowId: input.windowId,
    userAId: input.userAId,
    userBId: input.userBId,
    mutualScore: input.mutualScore,
  });

  const { data, error } = await resolveDbClient().rpc('create_pair_reservation', {
    p_window_id: input.windowId,
    p_user_a_id: input.userAId,
    p_user_b_id: input.userBId,
    p_mutual_score: input.mutualScore ?? null,
    p_plan_snapshot: input.planSnapshot ?? {},
    p_ttl_seconds: input.ttlSeconds ?? RESERVATION_TTL_SECONDS,
  });

  if (error) {
    logBackendError('reservation.createFailed', error, {
      windowId: input.windowId,
      userAId: input.userAId,
      userBId: input.userBId,
    });
    throwSupabaseError(op, error);
  }

  const reservationId = data as string;
  const reservation = await fetchPairReservationById(reservationId);
  if (!reservation) {
    throw new Error('Reservation created but could not be loaded');
  }

  logBackendInfo('reservation.created', {
    reservationId: reservation.id,
    windowId: reservation.windowId,
    userAId: reservation.userAId,
    userBId: reservation.userBId,
    mutualScore: reservation.mutualScore,
    expiresAt: reservation.expiresAt,
  });

  return reservation;
}

export async function fetchPairReservationById(
  reservationId: string,
): Promise<PairReservation | null> {
  if (!isDbAvailable()) {
    return null;
  }

  const op = 'pair_reservations.selectById';
  logSupabaseRequest(op, { reservationId });

  const { data, error } = await resolveDbClient()
    .from('pair_reservations')
    .select('*')
    .eq('id', reservationId)
    .maybeSingle();

  if (error) {
    throwSupabaseError(op, error);
  }

  if (!data) {
    return null;
  }

  return mapReservationRow(data as PairReservationRow);
}

export async function fetchPendingReservationsForWindow(
  windowId: string,
): Promise<PairReservation[]> {
  if (!isDbAvailable()) {
    return [];
  }

  const op = 'pair_reservations.selectPending';
  logSupabaseRequest(op, { windowId });

  const { data, error } = await resolveDbClient()
    .from('pair_reservations')
    .select('*')
    .eq('window_id', windowId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throwSupabaseError(op, error);
  }

  return ((data ?? []) as PairReservationRow[]).map(mapReservationRow);
}

/** User IDs with a pending reservation in the window (either column). */
export async function fetchReservedUserIdsForWindow(windowId: string): Promise<Set<string>> {
  const pending = await fetchPendingReservationsForWindow(windowId);
  const ids = new Set<string>();
  for (const row of pending) {
    ids.add(row.userAId);
    ids.add(row.userBId);
  }
  return ids;
}

export async function expirePairReservations(): Promise<number> {
  const op = 'rpc.expire_pair_reservations';
  logSupabaseRequest(op);

  const { data, error } = await resolveDbClient().rpc('expire_pair_reservations');

  if (error) {
    logBackendError('reservation.expireFailed', error);
    throwSupabaseError(op, error);
  }

  const expiredCount = (data as number) ?? 0;
  if (expiredCount > 0) {
    logBackendInfo('reservation.expired', { count: expiredCount });
  }

  return expiredCount;
}

export async function cancelPairReservation(
  reservationId: string,
): Promise<ReservationCancelResult> {
  const op = 'rpc.cancel_pair_reservation';
  logSupabaseRequest(op, { reservationId });

  const { data, error } = await resolveDbClient().rpc('cancel_pair_reservation', {
    p_reservation_id: reservationId,
  });

  if (error) {
    logBackendError('reservation.cancelFailed', error, { reservationId });
    throwSupabaseError(op, error);
  }

  const result = data as ReservationCancelResult;
  if (result.ok) {
    logBackendInfo('reservation.cancelled', { reservationId });
  } else {
    logBackendInfo('reservation.cancelRejected', { reservationId, error: result.error });
  }

  return result;
}

export async function commitPairReservation(
  reservationId: string,
): Promise<ReservationCommitResult> {
  const op = 'rpc.commit_pair_reservation';
  logSupabaseRequest(op, { reservationId });

  const { data, error } = await resolveDbClient().rpc('commit_pair_reservation', {
    p_reservation_id: reservationId,
  });

  if (error) {
    logBackendError('reservation.commitFailed', error, { reservationId });
    throwSupabaseError(op, error);
  }

  const raw = data as Record<string, unknown>;
  const result: ReservationCommitResult = {
    ok: Boolean(raw.ok),
    reservationId: (raw.reservationId ?? raw.reservation_id) as string | undefined,
    speedDateId: (raw.speedDateId ?? raw.speed_date_id) as string | undefined,
    windowId: (raw.windowId ?? raw.window_id) as string | undefined,
    userAId: (raw.userAId ?? raw.user_a_id) as string | undefined,
    userBId: (raw.userBId ?? raw.user_b_id) as string | undefined,
    error: raw.error as string | undefined,
    reasonCode: (raw.reasonCode ?? raw.reason_code) as string | undefined,
    userId: (raw.userId ?? raw.user_id) as string | undefined,
  };
  if (result.ok) {
    logBackendInfo('reservation.committed', {
      reservationId: result.reservationId,
      speedDateId: result.speedDateId,
      windowId: result.windowId,
      userAId: result.userAId,
      userBId: result.userBId,
      reasonCode: result.reasonCode ?? 'committed',
    });
  } else if (result.reasonCode === 'user_still_active') {
    logBackendInfo('reservation.commitBlockedStillActive', {
      reservationId,
      userId: result.userId,
      error: result.error,
      reasonCode: result.reasonCode,
    });
  } else {
    logBackendInfo('reservation.commitRejected', {
      reservationId,
      error: result.error,
      reasonCode: result.reasonCode,
      userId: result.userId,
    });
  }

  return result;
}

export async function fetchReservationsForWindow(
  windowId: string,
  statuses?: PairReservationStatus[],
): Promise<PairReservation[]> {
  if (!isDbAvailable()) {
    return [];
  }

  const op = 'pair_reservations.selectForWindow';
  logSupabaseRequest(op, { windowId, statuses });

  let query = resolveDbClient().from('pair_reservations').select('*').eq('window_id', windowId);

  if (statuses?.length) {
    query = query.in('status', statuses);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throwSupabaseError(op, error);
  }

  return ((data ?? []) as PairReservationRow[]).map(mapReservationRow);
}
