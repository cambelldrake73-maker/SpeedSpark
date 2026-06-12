import type { DatingPreferences, UserProfile } from './index';

export type QueueEntryStatus = 'waiting' | 'paired' | 'left';
export type SpeedDateStatus = 'active' | 'completed' | 'cancelled';
export type CandidateAvailability = 'waiting' | 'available_soon';

export interface QueueEntry {
  id: string;
  windowId: string;
  userId: string;
  status: QueueEntryStatus;
  joinedAt: string;
}

export interface QueueCounts {
  windowId: string;
  waiting: number;
  paired: number;
  left: number;
  total: number;
}

export interface QueueStatusResult {
  inQueue: boolean;
  entry: QueueEntry | null;
}

export interface SpeedDateRecord {
  id: string;
  windowId: string | null;
  userAId: string;
  userBId: string;
  startedAt: string;
  endedAt: string | null;
  status: SpeedDateStatus;
}

export interface MatchCandidate {
  userId: string;
  queueEntryId: string;
  joinedAt: string;
  profile: UserProfile;
  preferences: Partial<DatingPreferences>;
  availability: CandidateAvailability;
  speedDateId: string | null;
  secondsUntilAvailable: number;
  currentPartnerId: string | null;
}

export interface CompatibilityResult {
  compatible: boolean;
  score: number;
  reasons: string[];
  blockers: string[];
}

export interface PairingCandidatePair {
  userAId: string;
  userBId: string;
  score: number;
  reasons: string[];
}

export interface PairingEvaluatedPair {
  userAId: string;
  userBId: string;
  score: number;
  reasons: string[];
  applied: boolean;
}

export interface PairingOutcome {
  windowId: string;
  pairsCreated: number;
  speedDateIds: string[];
  unmatchedUserIds: string[];
  skippedPairs: Array<{ userAId: string; userBId: string; reason: string; score?: number }>;
  evaluatedPairs?: PairingEvaluatedPair[];
  waitPolicy?: import('./orchestrationMetrics').WaitPolicyRunMetrics;
}

export interface ReservationPlanOutcome {
  windowId: string;
  reservationsCreated: number;
  reservationIds: string[];
  immediateCommits: number;
  waitingCandidates: number;
  availableSoonCandidates: number;
  pendingReservationCount: number;
  evaluatedPairsCount: number;
  availableSoonSnapshots: Array<{ userId: string; secondsUntilAvailable: number }>;
  commitFailures: Array<{
    reservationId: string;
    reasonCode?: string;
    error?: string;
  }>;
  unmatchedUserIds: string[];
  skippedPairs: Array<{ userAId: string; userBId: string; reason: string; score?: number }>;
  evaluatedPairs?: PairingEvaluatedPair[];
  waitPolicy?: import('./orchestrationMetrics').WaitPolicyRunMetrics;
}
