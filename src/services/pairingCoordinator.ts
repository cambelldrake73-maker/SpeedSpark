import { PAIRING_MIN_WAITING_USERS } from '../constants/autoPairing';
import type { PairingOutcome } from '../types/matchingBackend';
import { logBackendInfo } from './backendLogger';
import { isDbAvailable, resolveDbClient } from './dbClient';
import { runPairingForWindow } from './pairingEngine';
import { runInServerPairingContext } from './pairingExecutionContext';
import {
  pairingWorkerId,
  releasePairingLock,
  tryAcquirePairingLock,
  type PairingTriggerSource,
} from './pairingLocks';
import { persistPairingRun, type PairingRunSummary } from './pairingRunLog';
import { getQueueCounts } from './queueService';

interface LiveWindowRow {
  id: string;
  label: string;
}

export interface PairingCoordinatorResult {
  triggerSource: PairingTriggerSource;
  windowsScanned: number;
  runs: PairingRunSummary[];
}

async function fetchLiveWindowIds(): Promise<LiveWindowRow[]> {
  if (!isDbAvailable()) {
    return [];
  }

  const { data, error } = await resolveDbClient()
    .from('speed_date_windows')
    .select('id, label')
    .eq('is_live', true)
    .order('start_time', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as LiveWindowRow[];
}

async function runPairingForWindowGuarded(
  windowId: string,
  triggerSource: PairingTriggerSource,
): Promise<PairingRunSummary> {
  return runInServerPairingContext(async () => {
    const workerId = pairingWorkerId(triggerSource);
    const counts = await getQueueCounts(windowId);

    logBackendInfo('pairing.run.start', {
      windowId,
      triggerSource,
      workerId,
      waiting: counts.waiting,
    });

    if (counts.waiting < PAIRING_MIN_WAITING_USERS) {
      const outcome: PairingOutcome = {
        windowId,
        pairsCreated: 0,
        speedDateIds: [],
        unmatchedUserIds: [],
        skippedPairs: [],
        evaluatedPairs: [],
      };
      logBackendInfo('pairing.run.skippedInsufficientQueue', {
        windowId,
        waiting: counts.waiting,
        required: PAIRING_MIN_WAITING_USERS,
      });
      return {
        windowId,
        triggerSource,
        candidatesConsidered: counts.waiting,
        outcome,
      };
    }

    const acquired = await tryAcquirePairingLock(windowId, workerId);
    if (!acquired) {
      logBackendInfo('pairing.run.skippedLocked', { windowId, workerId });
      return {
        windowId,
        triggerSource,
        candidatesConsidered: counts.waiting,
        skippedLock: true,
        outcome: {
          windowId,
          pairsCreated: 0,
          speedDateIds: [],
          unmatchedUserIds: [],
          skippedPairs: [],
          evaluatedPairs: [],
        },
      };
    }

    try {
      const waitingBeforeRun = counts.waiting;
      const outcome = await runPairingForWindow(windowId);

      logBackendInfo('pairing.run.complete', {
        windowId,
        pairsCreated: outcome.pairsCreated,
        unmatched: outcome.unmatchedUserIds.length,
        skipped: outcome.skippedPairs.length,
        speedDateIds: outcome.speedDateIds,
        unmatchedUserIds: outcome.unmatchedUserIds,
        topScores: outcome.evaluatedPairs?.slice(0, 5),
      });

      const summary: PairingRunSummary = {
        windowId,
        triggerSource,
        candidatesConsidered: waitingBeforeRun,
        outcome,
      };

      await persistPairingRun(summary);
      return summary;
    } finally {
      await releasePairingLock(windowId, workerId);
    }
  });
}

/** Runs pairing for a single window (dev console / targeted runs). */
export async function runPairingForWindowWithCoordinator(
  windowId: string,
  triggerSource: PairingTriggerSource,
): Promise<PairingRunSummary> {
  return runPairingForWindowGuarded(windowId, triggerSource);
}

/** Runs greedy pairing for live windows. Requires service-role client override. */
export async function runPairingForAllLiveWindows(
  triggerSource: PairingTriggerSource,
  options?: { windowId?: string },
): Promise<PairingCoordinatorResult> {
  const liveWindows = options?.windowId
    ? [{ id: options.windowId, label: 'targeted' }]
    : await fetchLiveWindowIds();

  logBackendInfo('pairing.coordinator.start', {
    triggerSource,
    liveWindows: liveWindows.length,
    windowIds: liveWindows.map((w) => w.id),
  });

  const runs: PairingRunSummary[] = [];

  for (const window of liveWindows) {
    try {
      const summary = await runPairingForWindowGuarded(window.id, triggerSource);
      runs.push(summary);
    } catch (error) {
      logBackendInfo('pairing.coordinator.windowFailed', {
        windowId: window.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logBackendInfo('pairing.coordinator.done', {
    triggerSource,
    windowsScanned: liveWindows.length,
    totalPairsCreated: runs.reduce((sum, run) => sum + run.outcome.pairsCreated, 0),
  });

  return {
    triggerSource,
    windowsScanned: liveWindows.length,
    runs,
  };
}
