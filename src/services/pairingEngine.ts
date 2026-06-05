import type { PairingOutcome } from '../types/matchingBackend';
import { fetchBlockedUserIds } from './blocks';
import { logBackendError, logBackendInfo, logPairingOutcome } from './backendLogger';
import { loadMatchCandidates } from './matchingData';
import { evaluateCompatibilityMatrix } from './matchingService';
import { applyQueuePair } from './speedDates';
import { getQueueCounts } from './queueService';

/**
 * Greedy maximum-weight pairing: highest compatibility first, no user paired twice.
 */
export async function runPairingForWindow(windowId: string): Promise<PairingOutcome> {
  const candidates = await loadMatchCandidates(windowId);

  if (candidates.length < 2) {
    const outcome: PairingOutcome = {
      windowId,
      pairsCreated: 0,
      speedDateIds: [],
      unmatchedUserIds: candidates.map((c) => c.userId),
      skippedPairs: [],
    };
    logPairingOutcome({
      windowId,
      pairsCreated: 0,
      unmatched: outcome.unmatchedUserIds.length,
      skipped: 0,
    });
    return outcome;
  }

  const withBlocks = await Promise.all(
    candidates.map(async (c) => ({
      userId: c.userId,
      profile: c.profile,
      preferences: c.preferences,
      blockedIds: await fetchBlockedUserIds(c.userId),
    })),
  );

  const rankedPairs = evaluateCompatibilityMatrix(withBlocks);
  const used = new Set<string>();
  const speedDateIds: string[] = [];
  const skippedPairs: PairingOutcome['skippedPairs'] = [];

  for (const pair of rankedPairs) {
    if (used.has(pair.userAId) || used.has(pair.userBId)) {
      continue;
    }

    try {
      const speedDateId = await applyQueuePair(windowId, pair.userAId, pair.userBId);
      used.add(pair.userAId);
      used.add(pair.userBId);
      speedDateIds.push(speedDateId);
      logBackendInfo('pairing.pairApplied', {
        windowId,
        userAId: pair.userAId,
        userBId: pair.userBId,
        score: pair.score,
        speedDateId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skippedPairs.push({
        userAId: pair.userAId,
        userBId: pair.userBId,
        reason: message,
      });
      logBackendError('pairing.pairFailed', error, {
        windowId,
        userAId: pair.userAId,
        userBId: pair.userBId,
      });
    }
  }

  const unmatchedUserIds = candidates
    .map((c) => c.userId)
    .filter((id) => !used.has(id));

  const outcome: PairingOutcome = {
    windowId,
    pairsCreated: speedDateIds.length,
    speedDateIds,
    unmatchedUserIds,
    skippedPairs,
  };

  const counts = await getQueueCounts(windowId);
  logPairingOutcome({
    windowId,
    pairsCreated: outcome.pairsCreated,
    unmatched: unmatchedUserIds.length,
    skipped: skippedPairs.length,
  });
  logBackendInfo('pairing.complete', { ...outcome, queueCounts: counts });

  return outcome;
}
