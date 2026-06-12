import type { GenderIdentity, UserProfile } from '../../types';
import {
  ABSOLUTE_MINIMUM_MUTUAL_SCORE,
  MINIMUM_MUTUAL_SCORE_MATRIX,
} from '../../constants/waitPolicy';
import { evaluateCompatibility } from '../matchingService';
import {
  filterPairsByWaitPolicy,
  formatWaitPolicyTable,
  getMinimumMutualScore,
  getPoolBucket,
  getWaitBucket,
  shouldAcceptPair,
} from '../waitPolicy';
import { logBackendInfo } from '../backendLogger';

function assert(condition: boolean, message: string, failures: string[]): void {
  if (!condition) {
    failures.push(message);
  }
}

function baseProfile(id: string, genderIdentity: GenderIdentity): UserProfile {
  return {
    id,
    name: id,
    age: 28,
    location: 'New York, NY',
    heightInches: 66,
    photos: [],
    genderIdentity,
    sexualOrientation: 'queer',
    datingIntentions: ['dates', 'relationship'],
    interestedInGenders: [],
    queerRoles: [],
    presentationTags: ['androgynous'],
    personalityTags: [],
    lifestyleTags: ['Creative', 'Foodie'],
    verificationStatus: 'verified',
    locationLatitude: 40.7128,
    locationLongitude: -74.006,
  };
}

export function runWaitPolicyTests(): { passed: number; failed: number; failures: string[] } {
  const failures: string[] = [];
  const TOTAL = 13;

  assert(
    getMinimumMutualScore(30, 25) === 70,
    'fresh + large pool requires score >= 70',
    failures,
  );
  assert(
    getMinimumMutualScore(30, 3) === 60,
    'fresh + tiny pool requires score >= 60',
    failures,
  );
  assert(
    getMinimumMutualScore(240, 4) === 48,
    'long wait + small pool accepts score >= 48',
    failures,
  );
  assert(
    getMinimumMutualScore(400, 3) === ABSOLUTE_MINIMUM_MUTUAL_SCORE,
    'extended + tiny pool floors at absolute minimum 40',
    failures,
  );

  assert(
    shouldAcceptPair(69, 20, 10, 25) === false,
    'score 69 rejected for fresh large pool (min 70)',
    failures,
  );
  assert(
    shouldAcceptPair(70, 20, 10, 25) === true,
    'score 70 accepted for fresh large pool',
    failures,
  );
  assert(
    shouldAcceptPair(48, 200, 200, 4) === true,
    'score 48 accepted for long wait small pool (min 48)',
    failures,
  );
  assert(
    shouldAcceptPair(47, 200, 200, 4) === false,
    'score 47 rejected for long wait small pool (min 48)',
    failures,
  );
  assert(
    shouldAcceptPair(39, 500, 500, 2) === false,
    'score below absolute floor 40 always rejects',
    failures,
  );

  assert(
    getWaitBucket(45) === 'fresh' &&
      getWaitBucket(120) === 'normal' &&
      getWaitBucket(240) === 'long' &&
      getWaitBucket(400) === 'extended',
    'wait bucket boundaries',
    failures,
  );
  assert(
    getPoolBucket(2) === 'tiny' &&
      getPoolBucket(5) === 'small' &&
      getPoolBucket(12) === 'medium' &&
      getPoolBucket(25) === 'large',
    'pool bucket boundaries',
    failures,
  );

  const waitMap = new Map([
    ['a', 400],
    ['b', 10],
  ]);
  const filtered = filterPairsByWaitPolicy(
    [{ userAId: 'a', userBId: 'b', score: 45 }],
    waitMap,
    3,
  );
  assert(filtered.accepted.length === 1, 'longer wait relaxes pair threshold (extended tiny min 40)', failures);

  const blocked = evaluateCompatibility({
    userA: {
      profile: { ...baseProfile('gate-a', 'woman'), accountStatus: 'active' },
      preferences: { preferredLookingFor: ['man'] },
    },
    userB: {
      profile: { ...baseProfile('gate-b', 'woman'), accountStatus: 'active' },
      preferences: { preferredLookingFor: ['woman'] },
    },
    blockedA: new Set(),
    blockedB: new Set(),
  });
  assert(!blocked.compatible, 'hard gender gate rejects regardless of wait policy', failures);
  assert(
    shouldAcceptPair(100, 500, 500, 2) && !blocked.compatible,
    'high score does not bypass hard gates (matrix path only scores compatible pairs)',
    failures,
  );

  assert(
    MINIMUM_MUTUAL_SCORE_MATRIX.extended.tiny >= ABSOLUTE_MINIMUM_MUTUAL_SCORE,
    'matrix never configures below absolute floor',
    failures,
  );

  const passed = TOTAL - failures.length;
  logBackendInfo('dev.waitPolicyTests', { passed, failed: failures.length, failures });
  return { passed, failed: failures.length, failures };
}

export function printWaitPolicyTable(): void {
  const table = formatWaitPolicyTable();
  console.log('[SpeedSpark Dev] wait policy minimum mutual score matrix');
  console.log(table);
}

if (__DEV__) {
  (globalThis as Record<string, unknown>).SpeedSparkWaitPolicyDev = {
    runWaitPolicyTests,
    printWaitPolicyTable,
  };
}
