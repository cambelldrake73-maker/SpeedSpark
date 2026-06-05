import type { PairingOutcome } from '../types/matchingBackend';
import { logBackendError, logBackendInfo, logPairingOutcome } from './backendLogger';
import {
  blockedIdsForUser,
  cleanupStaleQueueEntries,
  loadWindowMatchingBundle,
} from './matchingDataServer';
import { evaluateCompatibilityMatrix } from './matchingService';
import { isServerPairingExecution } from './pairingExecutionContext';
import { applyQueuePair } from './speedDatesPairing';
import { getQueueCounts } from './queueService';

const MAX_EVALUATED_PAIRS_LOGGED = 25;

/**
 * Greedy maximum-weight pairing: highest compatibility first, no user paired twice.
 * Must run inside server pairing context (Edge Function + service role).
 */
export async function runPairingForWindow(windowId: string): Promise<PairingOutcome> {
  if (!isServerPairingExecution()) {
    throw new Error(
      'Pairing must execute server-side. Deploy and invoke the pair-live-windows Edge Function.',
    );
  }

  await cleanupStaleQueueEntries(windowId);

  const { candidates, matchingContext, blockedByUser } = await loadWindowMatchingBundle(windowId);
  const candidateIds = candidates.map((c) => c.userId);

  if (candidates.length < 2) {
    const outcome: PairingOutcome = {
      windowId,
      pairsCreated: 0,
      speedDateIds: [],
      unmatchedUserIds: candidates.map((c) => c.userId),
      skippedPairs: [],
      evaluatedPairs: [],
    };
    logPairingOutcome({
      windowId,
      pairsCreated: 0,
      unmatched: outcome.unmatchedUserIds.length,
      skipped: 0,
    });
    return outcome;
  }

  const withBlocks = candidates.map((c) => ({
    userId: c.userId,
    profile: c.profile,
    preferences: c.preferences,
    blockedIds: blockedIdsForUser(blockedByUser, c.userId, candidateIds),
  }));

  const rankedPairs = evaluateCompatibilityMatrix(withBlocks, matchingContext);

  logBackendInfo('pairing.scores.ranked', {
    windowId,
    compatiblePairs: rankedPairs.length,
    topScores: rankedPairs.slice(0, 10).map((pair) => ({
      userAId: pair.userAId,
      userBId: pair.userBId,
      score: pair.score,
    })),
  });

  const used = new Set<string>();
  const speedDateIds: string[] = [];
  const skippedPairs: PairingOutcome['skippedPairs'] = [];
  const evaluatedPairs: PairingOutcome['evaluatedPairs'] = [];

  for (const pair of rankedPairs) {
    const alreadyUsed = used.has(pair.userAId) || used.has(pair.userBId);

    if (evaluatedPairs.length < MAX_EVALUATED_PAIRS_LOGGED) {
      evaluatedPairs.push({
        userAId: pair.userAId,
        userBId: pair.userBId,
        score: pair.score,
        reasons: pair.reasons,
        applied: false,
      });
    }

    if (alreadyUsed) {
      continue;
    }

    try {
      const speedDateId = await applyQueuePair(windowId, pair.userAId, pair.userBId);
      used.add(pair.userAId);
      used.add(pair.userBId);
      speedDateIds.push(speedDateId);

      const logged = evaluatedPairs.find(
        (entry) => entry.userAId === pair.userAId && entry.userBId === pair.userBId,
      );
      if (logged) {
        logged.applied = true;
      }

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
        score: pair.score,
      });
      logBackendError('pairing.pairFailed', error, {
        windowId,
        userAId: pair.userAId,
        userBId: pair.userBId,
        score: pair.score,
      });
    }
  }

  const unmatchedUserIds = candidates.map((c) => c.userId).filter((id) => !used.has(id));

  const outcome: PairingOutcome = {
    windowId,
    pairsCreated: speedDateIds.length,
    speedDateIds,
    unmatchedUserIds,
    skippedPairs,
    evaluatedPairs,
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
