import type { CandidateAvailability, ReservationPlanOutcome } from '../types/matchingBackend';
import {
  AVAILABLE_SOON_THRESHOLD_SECONDS,
  RESERVATION_AVAILABILITY_BUFFER_SECONDS,
} from '../constants/availableSoon';
import { RESERVATION_TTL_SECONDS } from '../constants/reservations';
import { logBackendError, logBackendInfo, logPairingOutcome } from './backendLogger';
import {
  blockedIdsForCandidate,
  cleanupStaleQueueEntries,
  loadWindowMatchingBundle,
} from './matchingDataServer';
import { evaluateCompatibilityMatrix } from './matchingService';
import { isServerPairingExecution } from './pairingExecutionContext';
import {
  commitPairReservation,
  createPairReservation,
  expirePairReservations,
  fetchReservedUserIdsForWindow,
} from './reservationService';
import { getQueueCounts } from './queueService';
import { buildWaitSecondsMap, filterPairsByWaitPolicy } from './waitPolicy';

const MAX_EVALUATED_PAIRS_LOGGED = 25;

type PairCommitMode = 'immediate_eligible' | 'reserve_only';

function resolvePairCommitMode(
  availabilityA: CandidateAvailability,
  availabilityB: CandidateAvailability,
): PairCommitMode {
  if (availabilityA === 'waiting' && availabilityB === 'waiting') {
    return 'immediate_eligible';
  }
  return 'reserve_only';
}

function reservationTtlSeconds(
  secondsUntilAvailableA: number,
  secondsUntilAvailableB: number,
): number {
  const availabilityWait = Math.max(secondsUntilAvailableA, secondsUntilAvailableB);
  if (availabilityWait <= 0) {
    return RESERVATION_TTL_SECONDS;
  }
  return Math.max(
    RESERVATION_TTL_SECONDS,
    Math.ceil(availabilityWait + RESERVATION_AVAILABILITY_BUFFER_SECONDS),
  );
}

function candidateById(candidates: Awaited<ReturnType<typeof loadWindowMatchingBundle>>['candidates']) {
  return new Map(candidates.map((candidate) => [candidate.userId, candidate]));
}

/**
 * Plan early: score waiting + available-soon users and hold pre-match reservations.
 * Does NOT create speed_dates rows unless both users are waiting and commit succeeds.
 */
export async function planPairsForWindow(windowId: string): Promise<ReservationPlanOutcome> {
  if (!isServerPairingExecution()) {
    throw new Error(
      'Reservation planning must execute server-side. Deploy and invoke with service role.',
    );
  }

  await cleanupStaleQueueEntries(windowId);
  await expirePairReservations();

  const { candidates, matchingContext, blockedByUser } = await loadWindowMatchingBundle(windowId);
  const candidateIds = candidates.map((c) => c.userId);
  const alreadyReserved = await fetchReservedUserIdsForWindow(windowId);
  const pendingReservationCount = alreadyReserved.size;
  const byId = candidateById(candidates);

  const waitingCandidates = candidates.filter((c) => c.availability === 'waiting').length;
  const availableSoonCandidates = candidates.filter((c) => c.availability === 'available_soon').length;

  if (availableSoonCandidates > 0) {
    logBackendInfo('reservation.plan.availableSoonFound', {
      windowId,
      count: availableSoonCandidates,
      users: candidates
        .filter((c) => c.availability === 'available_soon')
        .map((c) => ({
          userId: c.userId,
          secondsUntilAvailable: c.secondsUntilAvailable,
          speedDateId: c.speedDateId,
        })),
      thresholdSeconds: AVAILABLE_SOON_THRESHOLD_SECONDS,
    });
  }

  if (candidates.length < 2) {
    const outcome: ReservationPlanOutcome = {
      windowId,
      reservationsCreated: 0,
      reservationIds: [],
      immediateCommits: 0,
      waitingCandidates,
      availableSoonCandidates,
      pendingReservationCount,
      evaluatedPairsCount: 0,
      availableSoonSnapshots: candidates
        .filter((c) => c.availability === 'available_soon')
        .map((c) => ({ userId: c.userId, secondsUntilAvailable: c.secondsUntilAvailable })),
      commitFailures: [],
      unmatchedUserIds: candidates.map((c) => c.userId),
      skippedPairs: [],
      evaluatedPairs: [],
    };
    logBackendInfo('reservation.plan.skipped', {
      windowId,
      reason: 'insufficient_candidates',
      candidates: candidates.length,
      waitingCandidates,
      availableSoonCandidates,
    });
    return outcome;
  }

  const withBlocks = candidates.map((c) => ({
    userId: c.userId,
    profile: c.profile,
    preferences: c.preferences,
    blockedIds: blockedIdsForCandidate(blockedByUser, c, candidateIds),
  }));

  const rankedPairs = evaluateCompatibilityMatrix(withBlocks, matchingContext);
  const waitSecondsByUser = buildWaitSecondsMap(candidates);
  const waitFiltered = filterPairsByWaitPolicy(rankedPairs, waitSecondsByUser, candidates.length);

  logBackendInfo('reservation.plan.waitPolicy', {
    windowId,
    ...waitFiltered.metrics,
    compatibleBeforeFilter: rankedPairs.length,
    compatibleAfterFilter: waitFiltered.accepted.length,
  });

  logBackendInfo('reservation.plan.ranked', {
    windowId,
    compatiblePairs: waitFiltered.accepted.length,
    alreadyReserved: alreadyReserved.size,
    waitingCandidates,
    availableSoonCandidates,
    topScores: waitFiltered.accepted.slice(0, 10).map((pair) => ({
      userAId: pair.userAId,
      userBId: pair.userBId,
      score: pair.score,
    })),
  });

  const used = new Set<string>(alreadyReserved);
  const reservationIds: string[] = [];
  let immediateCommits = 0;
  const commitFailures: ReservationPlanOutcome['commitFailures'] = [];
  const availableSoonSnapshots: ReservationPlanOutcome['availableSoonSnapshots'] = [];
  const skippedPairs: ReservationPlanOutcome['skippedPairs'] = waitFiltered.rejected.map(
    (rejected) => ({
      userAId: rejected.userAId,
      userBId: rejected.userBId,
      reason: rejected.reason,
      score: rejected.score,
    }),
  );
  const evaluatedPairs: ReservationPlanOutcome['evaluatedPairs'] = [];

  for (const pair of rankedPairs) {
    if (evaluatedPairs.length < MAX_EVALUATED_PAIRS_LOGGED) {
      evaluatedPairs.push({
        userAId: pair.userAId,
        userBId: pair.userBId,
        score: pair.score,
        reasons: pair.reasons,
        applied: false,
      });
    }
  }

  for (const pair of waitFiltered.accepted) {
    const alreadyUsed = used.has(pair.userAId) || used.has(pair.userBId);
    const candidateA = byId.get(pair.userAId);
    const candidateB = byId.get(pair.userBId);

    if (!candidateA || !candidateB) {
      continue;
    }

    const commitMode = resolvePairCommitMode(candidateA.availability, candidateB.availability);
    const involvesAvailableSoon =
      candidateA.availability === 'available_soon' || candidateB.availability === 'available_soon';

    if (alreadyUsed) {
      continue;
    }

    try {
      const ttlSeconds = reservationTtlSeconds(
        candidateA.secondsUntilAvailable,
        candidateB.secondsUntilAvailable,
      );

      const reservation = await createPairReservation({
        windowId,
        userAId: pair.userAId,
        userBId: pair.userBId,
        mutualScore: pair.score,
        ttlSeconds,
        planSnapshot: {
          reasons: pair.reasons,
          plannedAt: new Date().toISOString(),
          mode: 'reservation_v2',
          commitMode,
          userAAvailability: candidateA.availability,
          userBAvailability: candidateB.availability,
          userASecondsUntilAvailable: candidateA.secondsUntilAvailable,
          userBSecondsUntilAvailable: candidateB.secondsUntilAvailable,
        },
      });

      used.add(pair.userAId);
      used.add(pair.userBId);
      reservationIds.push(reservation.id);

      const logged = evaluatedPairs.find(
        (entry) => entry.userAId === pair.userAId && entry.userBId === pair.userBId,
      );
      if (logged) {
        logged.applied = true;
      }

      if (involvesAvailableSoon) {
        logBackendInfo('reservation.plan.heldAvailableSoon', {
          windowId,
          reservationId: reservation.id,
          userAId: pair.userAId,
          userBId: pair.userBId,
          userAAvailability: candidateA.availability,
          userBAvailability: candidateB.availability,
          userASecondsUntilAvailable: candidateA.secondsUntilAvailable,
          userBSecondsUntilAvailable: candidateB.secondsUntilAvailable,
          score: pair.score,
          expiresAt: reservation.expiresAt,
          commitMode,
        });
      } else {
        logBackendInfo('reservation.plan.held', {
          windowId,
          reservationId: reservation.id,
          userAId: pair.userAId,
          userBId: pair.userBId,
          score: pair.score,
          expiresAt: reservation.expiresAt,
          commitMode,
        });
      }

      if (commitMode === 'immediate_eligible') {
        const commitResult = await commitPairReservation(reservation.id);
        if (commitResult.ok) {
          immediateCommits += 1;
          logBackendInfo('reservation.plan.immediateCommit', {
            windowId,
            reservationId: reservation.id,
            speedDateId: commitResult.speedDateId,
            userAId: pair.userAId,
            userBId: pair.userBId,
          });
        } else {
          commitFailures.push({
            reservationId: reservation.id,
            reasonCode: commitResult.reasonCode,
            error: commitResult.error,
          });
        }
      }

      if (involvesAvailableSoon) {
        for (const candidate of [candidateA, candidateB]) {
          if (candidate.availability === 'available_soon') {
            availableSoonSnapshots.push({
              userId: candidate.userId,
              secondsUntilAvailable: candidate.secondsUntilAvailable,
            });
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skippedPairs.push({
        userAId: pair.userAId,
        userBId: pair.userBId,
        reason: message,
        score: pair.score,
      });
      logBackendError('reservation.plan.holdFailed', error, {
        windowId,
        userAId: pair.userAId,
        userBId: pair.userBId,
        score: pair.score,
        userAAvailability: candidateA.availability,
        userBAvailability: candidateB.availability,
      });
    }
  }

  const unmatchedUserIds = candidates.map((c) => c.userId).filter((id) => !used.has(id));

  const outcome: ReservationPlanOutcome = {
    windowId,
    reservationsCreated: reservationIds.length,
    reservationIds,
    immediateCommits,
    waitingCandidates,
    availableSoonCandidates,
    pendingReservationCount,
    evaluatedPairsCount: rankedPairs.length,
    availableSoonSnapshots,
    commitFailures,
    unmatchedUserIds,
    skippedPairs,
    evaluatedPairs,
    waitPolicy: waitFiltered.metrics,
  };

  const counts = await getQueueCounts(windowId);
  logPairingOutcome({
    windowId,
    pairsCreated: outcome.immediateCommits,
    unmatched: unmatchedUserIds.length,
    skipped: skippedPairs.length,
  });
  logBackendInfo('reservation.plan.complete', { ...outcome, queueCounts: counts });

  return outcome;
}
