import type { PairingEvaluatedPair, PairingOutcome, ReservationPlanOutcome } from '../types/matchingBackend';
import type {
  OrchestrationRunMetrics,
  OrchestrationRunMode,
  PairingRunLogRecord,
  WaitPolicyRunMetrics,
  WindowReservationMetrics,
} from '../types/orchestrationMetrics';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { logBackendInfo } from './backendLogger';
import { isDbAvailable, resolveDbClient } from './dbClient';
import type { PairReservation, ReservationCommitResult } from './reservationService';
import { fetchPendingReservationsForWindow, fetchReservationsForWindow } from './reservationService';
import { getWaitingQueueEntries } from './queueService';
import type { PairingTriggerSource } from './pairingLocks';

interface PairingRunLogRow {
  id: string;
  window_id: string | null;
  trigger_source: string;
  candidates_considered: number;
  pairs_created: number;
  unmatched_count: number;
  skipped_count: number;
  details: Record<string, unknown>;
  created_at: string;
}

function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number | null, digits = 1): number | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }
  return round(numerator / denominator, 3);
}

function tallyReasons(
  entries: Array<{ reason?: string; reasonCode?: string; error?: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const key = entry.reasonCode ?? entry.reason ?? entry.error ?? 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function scoreStats(
  evaluatedPairs: PairingEvaluatedPair[] | undefined,
  skippedPairs: Array<{ score?: number; reason: string }>,
): {
  averageMutualScore: number | null;
  lowestAcceptedScore: number | null;
  highestRejectedScore: number | null;
} {
  const appliedScores = (evaluatedPairs ?? []).filter((pair) => pair.applied).map((pair) => pair.score);
  const rejectedScores = skippedPairs
    .map((pair) => pair.score)
    .filter((score): score is number => typeof score === 'number');

  return {
    averageMutualScore: round(mean(appliedScores)),
    lowestAcceptedScore: appliedScores.length ? Math.min(...appliedScores) : null,
    highestRejectedScore: rejectedScores.length ? Math.max(...rejectedScores) : null,
  };
}

export async function computeAverageWaitSeconds(windowId: string): Promise<number | null> {
  const waiting = await getWaitingQueueEntries(windowId);
  if (waiting.length === 0) {
    return null;
  }
  const now = Date.now();
  const waits = waiting.map((entry) => (now - new Date(entry.joinedAt).getTime()) / 1000);
  return round(mean(waits));
}

function estimateWaitSavedFromPlan(outcome: ReservationPlanOutcome): number | null {
  const snapshots = outcome.availableSoonSnapshots ?? [];
  if (snapshots.length === 0) {
    if (outcome.availableSoonCandidates > 0 && outcome.reservationsCreated > 0) {
      return round(outcome.availableSoonCandidates * 30);
    }
    return null;
  }
  return round(mean(snapshots.map((entry) => entry.secondsUntilAvailable).filter((value) => value > 0)));
}

function reservationHoldSeconds(reservation: PairReservation): number | null {
  if (!reservation.committedAt) {
    return null;
  }
  const created = new Date(reservation.createdAt).getTime();
  const committed = new Date(reservation.committedAt).getTime();
  return (committed - created) / 1000;
}

function secondsUntilAvailableFromSnapshot(reservation: PairReservation): number | null {
  const snapshot = reservation.planSnapshot ?? {};
  const a = snapshot.userASecondsUntilAvailable;
  const b = snapshot.userBSecondsUntilAvailable;
  if (typeof a === 'number' || typeof b === 'number') {
    return Math.max(typeof a === 'number' ? a : 0, typeof b === 'number' ? b : 0);
  }
  return null;
}

function mergeWaitPolicyFields(
  metrics: OrchestrationRunMetrics,
  waitPolicy?: WaitPolicyRunMetrics,
): OrchestrationRunMetrics {
  if (!waitPolicy) {
    return metrics;
  }
  return {
    ...metrics,
    waitBucket: waitPolicy.waitBucket,
    poolBucket: waitPolicy.poolBucket,
    minimumScoreApplied: waitPolicy.minimumScoreApplied,
    rejectedBelowThresholdCount: waitPolicy.rejectedBelowThresholdCount,
    acceptedBelowDefaultThresholdCount: waitPolicy.acceptedBelowDefaultThresholdCount,
  };
}

export function buildImmediatePairRunMetrics(input: {
  windowId: string;
  waitingCount: number;
  availableSoonCount?: number;
  pendingReservationCount?: number;
  outcome: PairingOutcome;
  skippedLock?: boolean;
  averageWaitSeconds?: number | null;
}): OrchestrationRunMetrics {
  const scores = scoreStats(input.outcome.evaluatedPairs, input.outcome.skippedPairs);
  const skippedReasons = tallyReasons(input.outcome.skippedPairs);

  const metrics: OrchestrationRunMetrics = {
    windowId: input.windowId,
    runMode: 'immediate',
    waitingCount: input.waitingCount,
    availableSoonCount: input.availableSoonCount ?? 0,
    pendingReservationCount: input.pendingReservationCount ?? 0,
    reservationsCreated: 0,
    reservationsCommitted: 0,
    reservationsExpired: 0,
    reservationsCancelled: 0,
    immediatePairsCreated: input.outcome.pairsCreated,
    usersSkipped: input.outcome.skippedPairs.length,
    skippedReasons,
    evaluatedPairsCount: input.outcome.evaluatedPairs?.length ?? 0,
    ...scores,
    averageWaitSeconds: input.averageWaitSeconds ?? null,
    estimatedWaitSavedSeconds: null,
    reservationSuccessRate: null,
    reservationExpirationRate: null,
    reservationCommitFailureRate: null,
    averageReservationHoldSeconds: null,
    averageSecondsUntilAvailable: null,
    commitFailureReasonCounts: {},
    inputs: {
      skippedLock: input.skippedLock ?? false,
      candidatesConsidered: input.waitingCount,
    },
    outputs: {
      speedDateIds: input.outcome.speedDateIds,
      unmatchedUserIds: input.outcome.unmatchedUserIds,
      evaluatedPairs: input.outcome.evaluatedPairs ?? [],
    },
  };

  return mergeWaitPolicyFields(metrics, input.outcome.waitPolicy);
}

export function buildReservationPlanRunMetrics(input: {
  windowId: string;
  outcome: ReservationPlanOutcome;
  pendingReservationCount: number;
  averageWaitSeconds?: number | null;
  skippedLock?: boolean;
}): OrchestrationRunMetrics {
  const { outcome } = input;
  const scores = scoreStats(outcome.evaluatedPairs, outcome.skippedPairs);
  const skippedReasons = tallyReasons(outcome.skippedPairs);
  const commitFailureReasonCounts = tallyReasons(outcome.commitFailures ?? []);
  const commitAttempts = (outcome.immediateCommits ?? 0) + (outcome.commitFailures?.length ?? 0);

  const metrics: OrchestrationRunMetrics = {
    windowId: input.windowId,
    runMode: 'reservation_plan',
    waitingCount: outcome.waitingCandidates,
    availableSoonCount: outcome.availableSoonCandidates,
    pendingReservationCount: input.pendingReservationCount,
    reservationsCreated: outcome.reservationsCreated,
    reservationsCommitted: outcome.immediateCommits,
    reservationsExpired: 0,
    reservationsCancelled: 0,
    immediatePairsCreated: outcome.immediateCommits,
    usersSkipped: outcome.skippedPairs.length,
    skippedReasons,
    evaluatedPairsCount: outcome.evaluatedPairsCount ?? outcome.evaluatedPairs?.length ?? 0,
    ...scores,
    averageWaitSeconds: input.averageWaitSeconds ?? null,
    estimatedWaitSavedSeconds: estimateWaitSavedFromPlan(outcome),
    reservationSuccessRate: rate(outcome.immediateCommits, outcome.reservationsCreated),
    reservationExpirationRate: null,
    reservationCommitFailureRate: rate(outcome.commitFailures?.length ?? 0, commitAttempts),
    averageReservationHoldSeconds: null,
    averageSecondsUntilAvailable:
      outcome.availableSoonCandidates > 0
        ? round(
            mean(
              (outcome.availableSoonSnapshots ?? [])
                .map((entry) => entry.secondsUntilAvailable)
                .filter((value) => value > 0),
            ),
          )
        : null,
    commitFailureReasonCounts,
    inputs: {
      skippedLock: input.skippedLock ?? false,
      pendingReservationCount: input.pendingReservationCount,
    },
    outputs: {
      reservationIds: outcome.reservationIds,
      unmatchedUserIds: outcome.unmatchedUserIds,
      commitFailures: outcome.commitFailures ?? [],
      evaluatedPairs: outcome.evaluatedPairs ?? [],
    },
  };

  return mergeWaitPolicyFields(metrics, outcome.waitPolicy);
}

export function buildReservationCommitRunMetrics(input: {
  windowId: string;
  result: ReservationCommitResult;
  waitingCount?: number;
  availableSoonCount?: number;
  pendingReservationCount?: number;
}): OrchestrationRunMetrics {
  const commitFailureReasonCounts = input.result.ok
    ? {}
    : tallyReasons([{ reasonCode: input.result.reasonCode, error: input.result.error }]);

  return {
    windowId: input.windowId,
    runMode: 'reservation_commit',
    waitingCount: input.waitingCount ?? 0,
    availableSoonCount: input.availableSoonCount ?? 0,
    pendingReservationCount: input.pendingReservationCount ?? 0,
    reservationsCreated: 0,
    reservationsCommitted: input.result.ok ? 1 : 0,
    reservationsExpired: 0,
    reservationsCancelled: 0,
    immediatePairsCreated: input.result.ok ? 1 : 0,
    usersSkipped: input.result.ok ? 0 : 1,
    skippedReasons: commitFailureReasonCounts,
    evaluatedPairsCount: 0,
    averageMutualScore: null,
    lowestAcceptedScore: null,
    highestRejectedScore: null,
    averageWaitSeconds: null,
    estimatedWaitSavedSeconds: null,
    reservationSuccessRate: input.result.ok ? 1 : 0,
    reservationExpirationRate: null,
    reservationCommitFailureRate: input.result.ok ? 0 : 1,
    averageReservationHoldSeconds: null,
    averageSecondsUntilAvailable: null,
    commitFailureReasonCounts,
    inputs: { reservationId: input.result.reservationId },
    outputs: { commitResult: input.result },
  };
}

export function buildReservationExpireRunMetrics(input: {
  windowId?: string;
  expiredCount: number;
}): OrchestrationRunMetrics {
  return {
    windowId: input.windowId ?? 'global',
    runMode: 'reservation_expire',
    waitingCount: 0,
    availableSoonCount: 0,
    pendingReservationCount: 0,
    reservationsCreated: 0,
    reservationsCommitted: 0,
    reservationsExpired: input.expiredCount,
    reservationsCancelled: 0,
    immediatePairsCreated: 0,
    usersSkipped: 0,
    skippedReasons: {},
    evaluatedPairsCount: 0,
    averageMutualScore: null,
    lowestAcceptedScore: null,
    highestRejectedScore: null,
    averageWaitSeconds: null,
    estimatedWaitSavedSeconds: null,
    reservationSuccessRate: null,
    reservationExpirationRate: input.expiredCount > 0 ? 1 : 0,
    reservationCommitFailureRate: null,
    averageReservationHoldSeconds: null,
    averageSecondsUntilAvailable: null,
    commitFailureReasonCounts: {},
    outputs: { expiredCount: input.expiredCount },
  };
}

function mapRunLogRow(row: PairingRunLogRow): PairingRunLogRecord {
  return {
    id: row.id,
    windowId: row.window_id,
    triggerSource: row.trigger_source,
    candidatesConsidered: row.candidates_considered,
    pairsCreated: row.pairs_created,
    unmatchedCount: row.unmatched_count,
    skippedCount: row.skipped_count,
    details: row.details as OrchestrationRunMetrics & Record<string, unknown>,
    createdAt: row.created_at,
  };
}

export async function fetchPairingRunLogs(
  windowId: string,
  limit = 25,
): Promise<PairingRunLogRecord[]> {
  if (!isDbAvailable()) {
    return [];
  }

  const op = 'pairing_run_logs.selectForWindow';
  logSupabaseRequest(op, { windowId, limit });

  const { data, error } = await resolveDbClient()
    .from('pairing_run_logs')
    .select('*')
    .eq('window_id', windowId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throwSupabaseError(op, error);
  }

  return ((data ?? []) as PairingRunLogRow[]).map(mapRunLogRow);
}

export async function fetchReservationMetrics(windowId: string): Promise<WindowReservationMetrics> {
  const [reservations, pending, runLogs] = await Promise.all([
    fetchReservationsForWindow(windowId),
    fetchPendingReservationsForWindow(windowId),
    fetchPairingRunLogs(windowId, 50),
  ]);

  const committed = reservations.filter((row) => row.status === 'committed');
  const expired = reservations.filter((row) => row.status === 'expired');
  const cancelled = reservations.filter((row) => row.status === 'cancelled');
  const terminal = committed.length + expired.length + cancelled.length;

  const holdSeconds = committed
    .map(reservationHoldSeconds)
    .filter((value): value is number => value !== null);
  const availabilitySeconds = reservations
    .map(secondsUntilAvailableFromSnapshot)
    .filter((value): value is number => value !== null);

  const commitFailureReasonCounts: Record<string, number> = {};
  for (const log of runLogs) {
    if (log.details.runMode !== 'reservation_commit' && log.details.runMode !== 'reservation_plan') {
      continue;
    }
    for (const [reason, count] of Object.entries(log.details.commitFailureReasonCounts ?? {})) {
      commitFailureReasonCounts[reason] = (commitFailureReasonCounts[reason] ?? 0) + count;
    }
  }

  const commitFailures = Object.values(commitFailureReasonCounts).reduce((sum, count) => sum + count, 0);
  const commitAttempts = committed.length + commitFailures;

  return {
    windowId,
    totalCreated: reservations.length,
    pending: pending.length,
    committed: committed.length,
    expired: expired.length,
    cancelled: cancelled.length,
    reservationSuccessRate: rate(committed.length, terminal),
    reservationExpirationRate: rate(expired.length, reservations.length),
    reservationCommitFailureRate: rate(commitFailures, commitAttempts),
    averageReservationHoldSeconds: round(mean(holdSeconds)),
    averageSecondsUntilAvailable: round(mean(availabilitySeconds)),
    commitFailureReasonCounts,
    recentRuns: runLogs.length,
  };
}

export async function printOrchestrationReport(windowId: string): Promise<{
  windowId: string;
  reservationMetrics: WindowReservationMetrics;
  recentRuns: PairingRunLogRecord[];
  health: 'healthy' | 'watch' | 'unhealthy';
  notes: string[];
}> {
  const [reservationMetrics, recentRuns] = await Promise.all([
    fetchReservationMetrics(windowId),
    fetchPairingRunLogs(windowId, 10),
  ]);

  const notes: string[] = [];
  let health: 'healthy' | 'watch' | 'unhealthy' = 'healthy';

  const successRate = reservationMetrics.reservationSuccessRate;
  const expirationRate = reservationMetrics.reservationExpirationRate;
  const commitFailureRate = reservationMetrics.reservationCommitFailureRate;

  if (successRate !== null && successRate >= 0.7) {
    notes.push('Reservation success rate is healthy (>= 70% committed vs terminal).');
  } else if (successRate !== null && successRate < 0.4) {
    health = 'unhealthy';
    notes.push('Low reservation success rate (< 40%) — holds may be expiring before users become available.');
  } else if (successRate !== null) {
    health = 'watch';
    notes.push('Moderate reservation success rate — review commit timing and TTL.');
  }

  if (expirationRate !== null && expirationRate > 0.5) {
    health = health === 'healthy' ? 'watch' : 'unhealthy';
    notes.push('High expiration rate (> 50%) — reservations may be timing out too early.');
  }

  if (commitFailureRate !== null && commitFailureRate > 0.3) {
    health = health === 'healthy' ? 'watch' : 'unhealthy';
    notes.push('Elevated commit failure rate — check user_still_active and not_waiting reasons.');
  }

  const latestPlan = recentRuns.find((run) => run.details.runMode === 'reservation_plan');
  if (latestPlan?.details.estimatedWaitSavedSeconds) {
    notes.push(
      `Latest plan estimated ~${latestPlan.details.estimatedWaitSavedSeconds}s wait saved via available-soon holds.`,
    );
  }

  if (reservationMetrics.pending > 0) {
    notes.push(`${reservationMetrics.pending} pending reservation(s) awaiting commit.`);
  }

  const report = {
    windowId,
    reservationMetrics,
    recentRuns,
    health,
    notes,
  };

  console.log('[SpeedSpark Orchestration Report]', JSON.stringify(report, null, 2));
  logBackendInfo('orchestration.report', { windowId, health, reservationMetrics, runCount: recentRuns.length });

  return report;
}

export async function persistOrchestrationRun(input: {
  windowId: string | null;
  triggerSource: PairingTriggerSource;
  metrics: OrchestrationRunMetrics;
  candidatesConsidered?: number;
  pairsCreated?: number;
  unmatchedCount?: number;
  skippedCount?: number;
}): Promise<void> {
  if (!isDbAvailable()) {
    return;
  }

  const op = 'pairing_run_logs.insertOrchestration';
  logSupabaseRequest(op, {
    windowId: input.windowId,
    runMode: input.metrics.runMode,
    pairsCreated: input.pairsCreated ?? input.metrics.immediatePairsCreated,
  });

  const { error } = await resolveDbClient().from('pairing_run_logs').insert({
    window_id: input.windowId,
    trigger_source: input.triggerSource,
    candidates_considered: input.candidatesConsidered ?? input.metrics.waitingCount,
    pairs_created: input.pairsCreated ?? input.metrics.immediatePairsCreated,
    unmatched_count: input.unmatchedCount ?? 0,
    skipped_count: input.skippedCount ?? input.metrics.usersSkipped,
    details: input.metrics,
  });

  if (error) {
    throwSupabaseError(op, error);
  }

  logBackendInfo('orchestration.runLogged', {
    windowId: input.windowId,
    runMode: input.metrics.runMode,
    reservationsCreated: input.metrics.reservationsCreated,
    immediatePairsCreated: input.metrics.immediatePairsCreated,
  });
}
