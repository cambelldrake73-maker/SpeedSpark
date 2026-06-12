import { logBackendInfo } from '../backendLogger';
import { runInServerPairingContext } from '../pairingExecutionContext';
import { runPlanPairsForWindowWithCoordinator } from '../pairingCoordinator';
import { invokeServerPairing } from '../pairingRemote';
import {
  commitPairReservation,
  expirePairReservations,
  fetchReservationsForWindow,
  type PairReservation,
  type ReservationCommitResult,
} from '../reservationService';
import { getQueueCounts, getWaitingQueueEntries, joinQueue } from '../queueService';
import { isSupabaseConfigured } from '../supabaseEnv';
import { upsertSpeedDateWindow } from '../windows';

export async function seedReservationTestWindow(): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase env vars required for dev seeding.');
  }

  const now = new Date();
  const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const id = `dev-reservation-window-${Date.now()}`;

  const window = await upsertSpeedDateWindow({
    id,
    label: 'Dev Reservation Window',
    description: 'Auto-seeded window for reservation orchestration testing',
    startTime: now.toISOString(),
    endTime: end.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    isLive: true,
  });

  logBackendInfo('dev.seedReservationTestWindow', { windowId: window.id });
  return window.id;
}

export async function simulateQueuePopulation(
  windowId: string,
  userIds: string[],
): Promise<void> {
  for (const userId of userIds) {
    await joinQueue(userId, windowId);
  }
  const counts = await getQueueCounts(windowId);
  logBackendInfo('dev.simulateQueuePopulation', { windowId, userIds, counts });
}

/**
 * Plan reservations for a window via Edge Function (service role).
 * Requires PAIRING_CRON_SECRET + deployed pair-live-windows.
 */
export async function runDevReservationPlan(windowId: string) {
  logBackendInfo('dev.reservation.plan.start', { windowId });
  const response = await invokeServerPairing({ windowId, mode: 'plan' });
  if (!response.ok) {
    throw new Error(response.error ?? 'Reservation plan invoke failed');
  }
  logBackendInfo('dev.reservation.plan.done', { windowId, response });
  return response;
}

/** Alias for planning with available-soon candidates included. */
export const planReservationsWithAvailableSoon = runDevReservationPlan;

/**
 * Seed two users on an active speed date ending soon (service role via Edge Function).
 * Returns speedDateId for completing the date later.
 */
export async function seedActiveDatesEndingSoon(
  windowId: string,
  userAId: string,
  userBId: string,
  secondsRemaining = 30,
): Promise<string> {
  const response = await invokeServerPairing({
    windowId,
    action: 'seedActiveDate',
    userAId,
    userBId,
    secondsRemaining,
  });
  if (!response.ok || !response.seedSpeedDateResult?.speedDateId) {
    throw new Error(response.error ?? response.seedSpeedDateResult?.error ?? 'Seed active date failed');
  }
  logBackendInfo('dev.reservation.seedActiveDatesEndingSoon', {
    windowId,
    userAId,
    userBId,
    secondsRemaining,
    speedDateId: response.seedSpeedDateResult.speedDateId,
  });
  return response.seedSpeedDateResult.speedDateId;
}

/**
 * Complete an active speed date and return both users to waiting (for commit testing).
 */
export async function completeActiveDateForTesting(speedDateId: string) {
  const response = await invokeServerPairing({ action: 'endSpeedDate', speedDateId });
  if (!response.ok || !response.endSpeedDateResult?.ok) {
    throw new Error(response.error ?? response.endSpeedDateResult?.error ?? 'End speed date failed');
  }
  logBackendInfo('dev.reservation.completeActiveDateForTesting', {
    speedDateId,
    result: response.endSpeedDateResult,
  });
  return response.endSpeedDateResult;
}

/**
 * End both users' current dates, then commit a pending reservation.
 * Typical flow: plan while one/both available-soon → complete dates → commit.
 */
export async function commitReservationAfterAvailability(
  reservationId: string,
  speedDateIdsToComplete: string[] = [],
) {
  for (const speedDateId of speedDateIdsToComplete) {
    await completeActiveDateForTesting(speedDateId);
  }
  return commitTestReservation(reservationId);
}

/**
 * Create a single test reservation by planning pairs for the window.
 * Returns the first reservation id when planning succeeds.
 */
export async function createTestReservation(windowId: string): Promise<string | null> {
  const response = await runDevReservationPlan(windowId);
  const planRun = response.planRuns?.find((run) => run.windowId === windowId) ?? response.planRuns?.[0];
  const reservationId = planRun?.reservationIds?.[0] ?? null;
  logBackendInfo('dev.reservation.createTest', { windowId, reservationId, planRun });
  return reservationId;
}

/** Commit a pending reservation (Edge Function with service role). */
export async function commitTestReservation(reservationId: string): Promise<ReservationCommitResult> {
  logBackendInfo('dev.reservation.commit.start', { reservationId });
  const response = await invokeServerPairing({ action: 'commit', reservationId });
  if (!response.ok) {
    throw new Error(response.error ?? 'Reservation commit invoke failed');
  }
  const result = response.commitResult ?? { ok: false, error: 'No commit result returned' };
  logBackendInfo('dev.reservation.commit.done', { reservationId, result });
  return result;
}

/** Expire stale pending reservations (Edge Function with service role). */
export async function expireStaleReservations(): Promise<number> {
  const response = await invokeServerPairing({ action: 'expire' });
  if (!response.ok) {
    throw new Error(response.error ?? 'Reservation expire invoke failed');
  }
  const count = response.expiredCount ?? 0;
  logBackendInfo('dev.reservation.expireStale', { count });
  return count;
}

export async function printReservationReport(windowId: string): Promise<{
  windowId: string;
  counts: Awaited<ReturnType<typeof getQueueCounts>>;
  waiting: Awaited<ReturnType<typeof getWaitingQueueEntries>>;
  reservations: PairReservation[];
}> {
  const response = await invokeServerPairing({ windowId, action: 'report' });
  if (!response.ok) {
    throw new Error(response.error ?? 'Reservation report invoke failed');
  }

  const counts = await getQueueCounts(windowId);
  const waiting = await getWaitingQueueEntries(windowId);
  const reservations = (response.reservations ?? []) as unknown as PairReservation[];

  console.log('[SpeedSpark Dev] reservation report', {
    windowId,
    counts,
    waiting: waiting.map((entry) => entry.userId),
    reservations,
  });

  return { windowId, counts, waiting, reservations };
}

export async function printOrchestrationReport(windowId: string) {
  const response = await invokeServerPairing({ windowId, action: 'orchestrationReport' });
  if (!response.ok || !response.orchestrationReport) {
    throw new Error(response.error ?? 'Orchestration report invoke failed');
  }
  console.log('[SpeedSpark Dev] orchestration report', response.orchestrationReport);
  return response.orchestrationReport;
}

export async function printReservationMetrics(windowId: string) {
  const response = await invokeServerPairing({ windowId, action: 'reservationMetrics' });
  if (!response.ok || !response.reservationMetrics) {
    throw new Error(response.error ?? 'Reservation metrics invoke failed');
  }
  console.log('[SpeedSpark Dev] reservation metrics', response.reservationMetrics);
  return response.reservationMetrics;
}

/** Run reservation plan in-process when service role client override is active. */
export async function runLocalReservationPlan(windowId: string) {
  return runInServerPairingContext(() =>
    runPlanPairsForWindowWithCoordinator(windowId, 'dev_console'),
  );
}

/** Direct RPC helpers when service role override is configured (Edge Function alternative). */
export async function commitReservationDirect(reservationId: string) {
  return commitPairReservation(reservationId);
}

export async function expireReservationsDirect() {
  return expirePairReservations();
}

export async function fetchReservationsDirect(windowId: string) {
  return fetchReservationsForWindow(windowId);
}

if (__DEV__) {
  (globalThis as Record<string, unknown>).SpeedSparkReservationDev = {
    seedReservationTestWindow,
    simulateQueuePopulation,
    runDevReservationPlan,
    planReservationsWithAvailableSoon,
    seedActiveDatesEndingSoon,
    completeActiveDateForTesting,
    commitReservationAfterAvailability,
    createTestReservation,
    commitTestReservation,
    expireStaleReservations,
    printReservationReport,
    printOrchestrationReport,
    printReservationMetrics,
    runLocalReservationPlan,
    commitReservationDirect,
    expireReservationsDirect,
    fetchReservationsDirect,
  };
}
