import type { DatingPreferences, LookingFor, QueerRole, SexualOrientation, UserProfile } from '../types';
import type { CompatibilityResult, PairingCandidatePair } from '../types/matchingBackend';
import { logMatchDecision } from './backendLogger';

function hasOverlap<T extends string>(a: T[] | undefined, b: T[] | undefined): boolean {
  if (!a?.length || !b?.length) {
    return false;
  }
  const setB = new Set(b);
  return a.some((v) => setB.has(v));
}

function passesAgeRange(
  viewerPrefs: Partial<DatingPreferences>,
  partnerProfile: UserProfile,
): boolean {
  const min = viewerPrefs.ageRangeMin ?? 18;
  const max = viewerPrefs.ageRangeMax ?? 99;
  return partnerProfile.age >= min && partnerProfile.age <= max;
}

function passesHeightRange(
  viewerPrefs: Partial<DatingPreferences>,
  partnerProfile: UserProfile,
): boolean {
  const height = partnerProfile.heightInches ?? 0;
  if (height <= 0) {
    return true;
  }
  const min = viewerPrefs.heightMinInches ?? 0;
  const max = viewerPrefs.heightMaxInches ?? 120;
  return height >= min && height <= max;
}

function passesOrientationFilter(
  viewerPrefs: Partial<DatingPreferences>,
  partnerProfile: UserProfile,
): boolean {
  const preferred = viewerPrefs.preferredOrientations ?? [];
  if (preferred.length === 0) {
    return true;
  }
  return preferred.includes(partnerProfile.sexualOrientation);
}

function passesLookingForFilter(
  viewerPrefs: Partial<DatingPreferences>,
  partnerProfile: UserProfile,
): boolean {
  const preferred = viewerPrefs.preferredLookingFor ?? [];
  if (preferred.length === 0) {
    return true;
  }
  return hasOverlap(preferred, partnerProfile.lookingFor);
}

function passesQueerRoleFilter(
  viewerPrefs: Partial<DatingPreferences>,
  partnerProfile: UserProfile,
): boolean {
  const preferred = viewerPrefs.preferredQueerRoles ?? [];
  if (preferred.length === 0) {
    return true;
  }
  return hasOverlap(preferred, partnerProfile.queerRoles);
}

function scorePair(
  profileA: UserProfile,
  prefsA: Partial<DatingPreferences>,
  profileB: UserProfile,
  prefsB: Partial<DatingPreferences>,
): { score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  if (hasOverlap(profileA.lookingFor, profileB.lookingFor)) {
    score += 15;
    reasons.push('Shared looking-for intentions');
  }

  if (hasOverlap(profileA.queerRoles, profileB.queerRoles)) {
    score += 10;
    reasons.push('Compatible queer roles');
  }

  if (hasOverlap(profileA.presentationTags, profileB.presentationTags)) {
    score += 8;
    reasons.push('Presentation overlap');
  }

  if (hasOverlap(profileA.personalityTags, profileB.personalityTags)) {
    score += 6;
    reasons.push('Personality tag overlap');
  }

  if (passesAgeRange(prefsA, profileB) && passesAgeRange(prefsB, profileA)) {
    score += 8;
    reasons.push('Mutual age range match');
  }

  if (passesOrientationFilter(prefsA, profileB) && passesOrientationFilter(prefsB, profileA)) {
    score += 6;
  }

  if (passesLookingForFilter(prefsA, profileB) && passesLookingForFilter(prefsB, profileA)) {
    score += 6;
  }

  const niceOverlap =
    prefsA.niceToHaves?.filter((t) => profileB.lifestyleTags.includes(t)) ?? [];
  if (niceOverlap.length > 0) {
    score += 4;
    reasons.push('Nice-to-have lifestyle overlap');
  }

  return { score: Math.min(100, score), reasons };
}

export function evaluateCompatibility(input: {
  userA: { profile: UserProfile; preferences: Partial<DatingPreferences> };
  userB: { profile: UserProfile; preferences: Partial<DatingPreferences> };
  blockedA: Set<string>;
  blockedB: Set<string>;
}): CompatibilityResult {
  const blockers: string[] = [];
  const { profile: profileA, preferences: prefsA } = input.userA;
  const { profile: profileB, preferences: prefsB } = input.userB;

  if (profileA.id === profileB.id) {
    blockers.push('Cannot match the same user');
    return { compatible: false, score: 0, reasons: [], blockers };
  }

  if (input.blockedA.has(profileB.id) || input.blockedB.has(profileA.id)) {
    blockers.push('Blocked relationship');
    return { compatible: false, score: 0, reasons: [], blockers };
  }

  if (!hasOverlap(profileA.lookingFor, profileB.lookingFor)) {
    blockers.push('No shared looking-for intentions');
  }

  if (!passesAgeRange(prefsA, profileB)) {
    blockers.push('Age outside A preferred range');
  }
  if (!passesAgeRange(prefsB, profileA)) {
    blockers.push('Age outside B preferred range');
  }

  if (!passesHeightRange(prefsA, profileB) || !passesHeightRange(prefsB, profileA)) {
    blockers.push('Height outside preferred range');
  }

  if (!passesOrientationFilter(prefsA, profileB)) {
    blockers.push('Orientation mismatch for A');
  }
  if (!passesOrientationFilter(prefsB, profileA)) {
    blockers.push('Orientation mismatch for B');
  }

  if (!passesLookingForFilter(prefsA, profileB) || !passesLookingForFilter(prefsB, profileA)) {
    blockers.push('Looking-for preference mismatch');
  }

  if (!passesQueerRoleFilter(prefsA, profileB) || !passesQueerRoleFilter(prefsB, profileA)) {
    blockers.push('Queer role preference mismatch');
  }

  const { score, reasons } = scorePair(profileA, prefsA, profileB, prefsB);
  const compatible = blockers.length === 0;

  const result: CompatibilityResult = {
    compatible,
    score: compatible ? score : 0,
    reasons,
    blockers,
  };

  logMatchDecision({
    viewerId: profileA.id,
    partnerId: profileB.id,
    compatible: result.compatible,
    score: result.score,
    blockers: result.blockers,
    reasons: result.reasons,
  });

  return result;
}

export function evaluateCompatibilityMatrix(
  candidates: Array<{
    userId: string;
    profile: UserProfile;
    preferences: Partial<DatingPreferences>;
    blockedIds: Set<string>;
  }>,
): PairingCandidatePair[] {
  const pairs: PairingCandidatePair[] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];
      const result = evaluateCompatibility({
        userA: { profile: a.profile, preferences: a.preferences },
        userB: { profile: b.profile, preferences: b.preferences },
        blockedA: a.blockedIds,
        blockedB: b.blockedIds,
      });

      if (result.compatible) {
        pairs.push({
          userAId: a.userId,
          userBId: b.userId,
          score: result.score,
          reasons: result.reasons,
        });
      }
    }
  }

  return pairs.sort((x, y) => y.score - x.score);
}
