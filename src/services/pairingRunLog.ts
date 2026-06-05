import type { PairingOutcome } from '../types/matchingBackend';
import { logSupabaseRequest, throwSupabaseError } from '../utils/supabaseDebug';
import { isDbAvailable, resolveDbClient } from './dbClient';
import { logBackendInfo } from './backendLogger';
import type { PairingTriggerSource } from './pairingLocks';

export interface PairingRunSummary {
  windowId: string;
  triggerSource: PairingTriggerSource;
  candidatesConsidered: number;
  outcome: PairingOutcome;
  skippedLock?: boolean;
}

export async function persistPairingRun(summary: PairingRunSummary): Promise<void> {
  if (!isDbAvailable()) {
    return;
  }

  const op = 'pairing_run_logs.insert';
  logSupabaseRequest(op, {
    windowId: summary.windowId,
    triggerSource: summary.triggerSource,
    pairsCreated: summary.outcome.pairsCreated,
  });

  const { error } = await resolveDbClient().from('pairing_run_logs').insert({
    window_id: summary.windowId,
    trigger_source: summary.triggerSource,
    candidates_considered: summary.candidatesConsidered,
    pairs_created: summary.outcome.pairsCreated,
    unmatched_count: summary.outcome.unmatchedUserIds.length,
    skipped_count: summary.outcome.skippedPairs.length,
    details: {
      speedDateIds: summary.outcome.speedDateIds,
      unmatchedUserIds: summary.outcome.unmatchedUserIds,
      skippedPairs: summary.outcome.skippedPairs,
      evaluatedPairs: summary.outcome.evaluatedPairs ?? [],
      skippedLock: summary.skippedLock ?? false,
    },
  });

  if (error) {
    throwSupabaseError(op, error);
  }

  logBackendInfo('pairing.runLogged', {
    windowId: summary.windowId,
    triggerSource: summary.triggerSource,
    pairsCreated: summary.outcome.pairsCreated,
  });
}
