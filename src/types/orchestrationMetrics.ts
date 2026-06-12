import type { PoolBucket, WaitBucket } from '../constants/waitPolicy';

/** How an orchestration tick was executed (stored in pairing_run_logs.details). */
export type OrchestrationRunMode =
  | 'immediate'
  | 'reservation_plan'
  | 'reservation_commit'
  | 'reservation_expire'
  | 'mixed';

export interface WaitPolicyRunMetrics {
  waitBucket: WaitBucket;
  poolBucket: PoolBucket;
  minimumScoreApplied: number;
  rejectedBelowThresholdCount: number;
  acceptedBelowDefaultThresholdCount: number;
  maxWaitSecondsInPool: number;
}

/** Structured metrics for a single orchestration run. */
export interface OrchestrationRunMetrics {
  windowId: string;
  runMode: OrchestrationRunMode;
  waitingCount: number;
  availableSoonCount: number;
  pendingReservationCount: number;
  reservationsCreated: number;
  reservationsCommitted: number;
  reservationsExpired: number;
  reservationsCancelled: number;
  immediatePairsCreated: number;
  usersSkipped: number;
  skippedReasons: Record<string, number>;
  evaluatedPairsCount: number;
  averageMutualScore: number | null;
  lowestAcceptedScore: number | null;
  highestRejectedScore: number | null;
  averageWaitSeconds: number | null;
  estimatedWaitSavedSeconds: number | null;
  reservationSuccessRate: number | null;
  reservationExpirationRate: number | null;
  reservationCommitFailureRate: number | null;
  averageReservationHoldSeconds: number | null;
  averageSecondsUntilAvailable: number | null;
  commitFailureReasonCounts: Record<string, number>;
  waitBucket?: WaitBucket;
  poolBucket?: PoolBucket;
  minimumScoreApplied?: number;
  rejectedBelowThresholdCount?: number;
  acceptedBelowDefaultThresholdCount?: number;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

/** Window-level reservation rollup (all-time or recent window activity). */
export interface WindowReservationMetrics {
  windowId: string;
  totalCreated: number;
  pending: number;
  committed: number;
  expired: number;
  cancelled: number;
  reservationSuccessRate: number | null;
  reservationExpirationRate: number | null;
  reservationCommitFailureRate: number | null;
  averageReservationHoldSeconds: number | null;
  averageSecondsUntilAvailable: number | null;
  commitFailureReasonCounts: Record<string, number>;
  recentRuns: number;
}

export interface PairingRunLogRecord {
  id: string;
  windowId: string | null;
  triggerSource: string;
  candidatesConsidered: number;
  pairsCreated: number;
  unmatchedCount: number;
  skippedCount: number;
  details: OrchestrationRunMetrics & Record<string, unknown>;
  createdAt: string;
}
