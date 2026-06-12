import type { PairingOutcome, ReservationPlanOutcome } from '../types/matchingBackend';
import {
  buildImmediatePairRunMetrics,
  buildReservationCommitRunMetrics,
  buildReservationExpireRunMetrics,
  buildReservationPlanRunMetrics,
  computeAverageWaitSeconds,
  persistOrchestrationRun,
} from './orchestrationMetrics';
import { logBackendInfo } from './backendLogger';
import type { PairingTriggerSource } from './pairingLocks';
import type { ReservationCommitResult } from './reservationService';
import { fetchPendingReservationsForWindow } from './reservationService';

export interface PairingRunSummary {
  windowId: string;
  triggerSource: PairingTriggerSource;
  candidatesConsidered: number;
  outcome: PairingOutcome;
  skippedLock?: boolean;
}

export interface ReservationPlanRunSummary {
  windowId: string;
  triggerSource: PairingTriggerSource;
  candidatesConsidered: number;
  outcome: ReservationPlanOutcome;
  skippedLock?: boolean;
}

export async function persistPairingRun(summary: PairingRunSummary): Promise<void> {
  const pendingReservationCount = (await fetchPendingReservationsForWindow(summary.windowId)).length;
  const averageWaitSeconds = await computeAverageWaitSeconds(summary.windowId);
  const metrics = buildImmediatePairRunMetrics({
    windowId: summary.windowId,
    waitingCount: summary.candidatesConsidered,
    pendingReservationCount,
    outcome: summary.outcome,
    skippedLock: summary.skippedLock,
    averageWaitSeconds,
  });

  await persistOrchestrationRun({
    windowId: summary.windowId,
    triggerSource: summary.triggerSource,
    metrics,
    candidatesConsidered: summary.candidatesConsidered,
    pairsCreated: summary.outcome.pairsCreated,
    unmatchedCount: summary.outcome.unmatchedUserIds.length,
    skippedCount: summary.outcome.skippedPairs.length,
  });

  logBackendInfo('pairing.runLogged', {
    windowId: summary.windowId,
    triggerSource: summary.triggerSource,
    pairsCreated: summary.outcome.pairsCreated,
    runMode: metrics.runMode,
  });
}

export async function persistReservationPlanRun(summary: ReservationPlanRunSummary): Promise<void> {
  const averageWaitSeconds = await computeAverageWaitSeconds(summary.windowId);
  const metrics = buildReservationPlanRunMetrics({
    windowId: summary.windowId,
    outcome: summary.outcome,
    pendingReservationCount: summary.outcome.pendingReservationCount,
    averageWaitSeconds,
    skippedLock: summary.skippedLock,
  });

  await persistOrchestrationRun({
    windowId: summary.windowId,
    triggerSource: summary.triggerSource,
    metrics,
    candidatesConsidered: summary.candidatesConsidered,
    pairsCreated: summary.outcome.immediateCommits,
    unmatchedCount: summary.outcome.unmatchedUserIds.length,
    skippedCount: summary.outcome.skippedPairs.length,
  });
}

export async function persistReservationCommitRun(input: {
  windowId: string;
  triggerSource: PairingTriggerSource;
  result: ReservationCommitResult;
  waitingCount?: number;
  availableSoonCount?: number;
}): Promise<void> {
  const pendingReservationCount = (await fetchPendingReservationsForWindow(input.windowId)).length;
  const metrics = buildReservationCommitRunMetrics({
    ...input,
    pendingReservationCount,
  });

  await persistOrchestrationRun({
    windowId: input.windowId,
    triggerSource: input.triggerSource,
    metrics,
    pairsCreated: metrics.immediatePairsCreated,
    skippedCount: metrics.usersSkipped,
  });
}

export async function persistReservationExpireRun(input: {
  windowId?: string;
  triggerSource: PairingTriggerSource;
  expiredCount: number;
}): Promise<void> {
  const metrics = buildReservationExpireRunMetrics({
    windowId: input.windowId,
    expiredCount: input.expiredCount,
  });

  await persistOrchestrationRun({
    windowId: input.windowId ?? null,
    triggerSource: input.triggerSource,
    metrics,
    pairsCreated: 0,
    skippedCount: 0,
  });
}
