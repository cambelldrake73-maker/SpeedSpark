import type { MatchCandidate } from '../types/matchingBackend';
import type { WaitPolicyRunMetrics } from '../types/orchestrationMetrics';
import {
  ABSOLUTE_MINIMUM_MUTUAL_SCORE,
  AVAILABLE_SOON_DEFAULT_WAIT_SECONDS,
  DEFAULT_SOFT_MUTUAL_SCORE,
  MINIMUM_MUTUAL_SCORE_MATRIX,
  WAIT_BUCKET_FRESH_MAX_SECONDS,
  WAIT_BUCKET_LONG_MAX_SECONDS,
  WAIT_BUCKET_NORMAL_MAX_SECONDS,
  type PoolBucket,
  type WaitBucket,
} from '../constants/waitPolicy';

export type { PoolBucket, WaitBucket, WaitPolicyRunMetrics };

/** Classify queue wait duration for adaptive soft-score thresholds. */
export function getWaitBucket(waitSeconds: number): WaitBucket {
  if (waitSeconds <= WAIT_BUCKET_FRESH_MAX_SECONDS) {
    return 'fresh';
  }
  if (waitSeconds <= WAIT_BUCKET_NORMAL_MAX_SECONDS) {
    return 'normal';
  }
  if (waitSeconds <= WAIT_BUCKET_LONG_MAX_SECONDS) {
    return 'long';
  }
  return 'extended';
}

/** Classify planning pool size (waiting + available-soon candidates). */
export function getPoolBucket(poolSize: number): PoolBucket {
  if (poolSize <= 3) {
    return 'tiny';
  }
  if (poolSize <= 5) {
    return 'small';
  }
  if (poolSize <= 20) {
    return 'medium';
  }
  return 'large';
}

/**
 * Minimum mutual score for a pair given pool wait context.
 * Uses waitSeconds representing the longer-waiting user in the pair.
 */
export function getMinimumMutualScore(waitSeconds: number, poolSize: number): number {
  const waitBucket = getWaitBucket(waitSeconds);
  const poolBucket = getPoolBucket(poolSize);
  const configured = MINIMUM_MUTUAL_SCORE_MATRIX[waitBucket][poolBucket];
  return Math.max(ABSOLUTE_MINIMUM_MUTUAL_SCORE, configured);
}

/**
 * Soft-score acceptance gate applied after hard filters and mutual scoring.
 * Uses max(waitA, waitB) so the user who waited longer sets the (lower) threshold.
 */
export function shouldAcceptPair(
  score: number,
  waitSecondsA: number,
  waitSecondsB: number,
  poolSize: number,
): boolean {
  const pairWaitSeconds = Math.max(waitSecondsA, waitSecondsB);
  const minimum = getMinimumMutualScore(pairWaitSeconds, poolSize);
  return score >= minimum;
}

export function getPairMinimumScore(
  waitSecondsA: number,
  waitSecondsB: number,
  poolSize: number,
): number {
  return getMinimumMutualScore(Math.max(waitSecondsA, waitSecondsB), poolSize);
}

/** Derive wait seconds for a candidate (waiting or available-soon). */
export function computeCandidateWaitSeconds(
  candidate: MatchCandidate,
  nowMs: number = Date.now(),
): number {
  if (candidate.availability === 'waiting' && candidate.joinedAt) {
    return Math.max(0, (nowMs - new Date(candidate.joinedAt).getTime()) / 1000);
  }

  if (candidate.joinedAt) {
    return Math.max(0, (nowMs - new Date(candidate.joinedAt).getTime()) / 1000);
  }

  return AVAILABLE_SOON_DEFAULT_WAIT_SECONDS;
}

export function buildWaitSecondsMap(
  candidates: MatchCandidate[],
  nowMs: number = Date.now(),
): Map<string, number> {
  const map = new Map<string, number>();
  for (const candidate of candidates) {
    map.set(candidate.userId, computeCandidateWaitSeconds(candidate, nowMs));
  }
  return map;
}

export function maxWaitSecondsInPool(waitSecondsByUser: Map<string, number>): number {
  let max = 0;
  for (const seconds of waitSecondsByUser.values()) {
    if (seconds > max) {
      max = seconds;
    }
  }
  return max;
}

export interface WaitPolicyFilterResult<T extends { userAId: string; userBId: string; score: number }> {
  accepted: T[];
  rejected: Array<T & { reason: string; minimumScore: number }>;
  metrics: WaitPolicyRunMetrics;
}

/**
 * Filter ranked compatible pairs by adaptive minimum mutual score.
 * Hard gates must already be applied upstream (evaluateCompatibilityMatrix).
 */
export function filterPairsByWaitPolicy<T extends { userAId: string; userBId: string; score: number }>(
  pairs: T[],
  waitSecondsByUser: Map<string, number>,
  poolSize: number,
): WaitPolicyFilterResult<T> {
  const maxWait = maxWaitSecondsInPool(waitSecondsByUser);
  const waitBucket = getWaitBucket(maxWait);
  const poolBucket = getPoolBucket(poolSize);
  const minimumScoreApplied = getMinimumMutualScore(maxWait, poolSize);

  const accepted: T[] = [];
  const rejected: Array<T & { reason: string; minimumScore: number }> = [];
  let acceptedBelowDefaultThresholdCount = 0;

  for (const pair of pairs) {
    const waitA = waitSecondsByUser.get(pair.userAId) ?? 0;
    const waitB = waitSecondsByUser.get(pair.userBId) ?? 0;
    const pairMinimum = getPairMinimumScore(waitA, waitB, poolSize);

    if (shouldAcceptPair(pair.score, waitA, waitB, poolSize)) {
      accepted.push(pair);
      if (pair.score < DEFAULT_SOFT_MUTUAL_SCORE) {
        acceptedBelowDefaultThresholdCount += 1;
      }
    } else {
      rejected.push({
        ...pair,
        minimumScore: pairMinimum,
        reason: `below_wait_policy_threshold (score=${pair.score}, minimum=${pairMinimum})`,
      });
    }
  }

  return {
    accepted,
    rejected,
    metrics: {
      waitBucket,
      poolBucket,
      minimumScoreApplied,
      rejectedBelowThresholdCount: rejected.length,
      acceptedBelowDefaultThresholdCount,
      maxWaitSecondsInPool: maxWait,
    },
  };
}

export function emptyWaitPolicyMetrics(poolSize: number): WaitPolicyRunMetrics {
  return {
    waitBucket: 'fresh',
    poolBucket: getPoolBucket(poolSize),
    minimumScoreApplied: getMinimumMutualScore(0, poolSize),
    rejectedBelowThresholdCount: 0,
    acceptedBelowDefaultThresholdCount: 0,
    maxWaitSecondsInPool: 0,
  };
}

/** Console-friendly threshold matrix for dev inspection. */
export function formatWaitPolicyTable(): string {
  const waitBuckets: WaitBucket[] = ['fresh', 'normal', 'long', 'extended'];
  const poolBuckets: PoolBucket[] = ['tiny', 'small', 'medium', 'large'];
  const header = ['wait \\ pool', ...poolBuckets].join('\t');
  const rows = waitBuckets.map((wait) => {
    const cells = poolBuckets.map((pool) => String(MINIMUM_MUTUAL_SCORE_MATRIX[wait][pool]));
    return [wait, ...cells].join('\t');
  });
  return [header, ...rows].join('\n');
}
