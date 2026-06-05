import {
  DEFAULT_MATCHING_PRIORITY_ORDER,
  normalizeMatchingPriorityOrder,
  priorityWeights,
} from '../constants/matchingPriorities';
import type { DatingPreferences, MatchingPriorityCategory, UserProfile } from '../types';
import type { CompatibilityResult, PairingCandidatePair } from '../types/matchingBackend';
import { distanceMiles } from '../utils/matchingGeometry';
import { NEUTRAL_APPEARANCE_SCORE } from './matchingAppearance';
import { logMatchDecision } from './backendLogger';

export interface MatchingContext {
  recentPairKeys?: Set<string>;
  reportedPairKeys?: Set<string>;
  appearanceScoresByViewer?: Map<string, Map<string, number>>;
}

function hasOverlap<T extends string>(a: T[] | undefined, b: T[] | undefined): boolean {
  if (!a?.length || !b?.length) {
    return false;
  }
  const setB = new Set(b);
  return a.some((v) => setB.has(v));
}

function overlapRatio(a: string[] | undefined, b: string[] | undefined): number {
  if (!a?.length || !b?.length) {
    return 0;
  }
  const setB = new Set(b);
  const overlap = a.filter((v) => setB.has(v)).length;
  return overlap / Math.max(a.length, b.length);
}

function pairKey(userAId: string, userBId: string): string {
  return [userAId, userBId].sort().join(':');
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

function hasDealbreakerHit(
  viewerPrefs: Partial<DatingPreferences>,
  partnerProfile: UserProfile,
): boolean {
  const dealbreakers = viewerPrefs.dealbreakers ?? [];
  if (dealbreakers.length === 0) {
    return false;
  }
  const partnerTags = new Set([
    ...partnerProfile.lifestyleTags,
    ...partnerProfile.personalityTags,
  ]);
  return dealbreakers.some((tag) => partnerTags.has(tag));
}

function exceedsMaxDistance(
  viewerPrefs: Partial<DatingPreferences>,
  viewerProfile: UserProfile,
  partnerProfile: UserProfile,
): boolean {
  const maxMiles = viewerPrefs.maxDistanceMiles ?? 25;
  const latA = viewerProfile.locationLatitude;
  const lngA = viewerProfile.locationLongitude;
  const latB = partnerProfile.locationLatitude;
  const lngB = partnerProfile.locationLongitude;

  if (latA == null || lngA == null || latB == null || lngB == null) {
    return false;
  }

  return distanceMiles(latA, lngA, latB, lngB) > maxMiles;
}

function scoreAgeFit(viewerPrefs: Partial<DatingPreferences>, partner: UserProfile): number {
  const min = viewerPrefs.ageRangeMin ?? 18;
  const max = viewerPrefs.ageRangeMax ?? 99;
  const age = partner.age;

  if (age >= min && age <= max) {
    return 100;
  }

  const distance = age < min ? min - age : age - max;
  return Math.max(0, 100 - distance * 12);
}

function scoreHeightFit(viewerPrefs: Partial<DatingPreferences>, partner: UserProfile): number {
  const height = partner.heightInches ?? 0;
  if (height <= 0) {
    return 50;
  }

  const min = viewerPrefs.heightMinInches ?? 0;
  const max = viewerPrefs.heightMaxInches ?? 120;

  if (height >= min && height <= max) {
    return 100;
  }

  const distance = height < min ? min - height : height - max;
  return Math.max(0, 100 - distance * 3);
}

function scoreDistanceFit(
  viewerPrefs: Partial<DatingPreferences>,
  viewer: UserProfile,
  partner: UserProfile,
): number {
  const maxMiles = viewerPrefs.maxDistanceMiles ?? 25;
  const latA = viewer.locationLatitude;
  const lngA = viewer.locationLongitude;
  const latB = partner.locationLatitude;
  const lngB = partner.locationLongitude;

  if (latA == null || lngA == null || latB == null || lngB == null) {
    return 50;
  }

  const miles = distanceMiles(latA, lngA, latB, lngB);
  if (miles <= maxMiles) {
    return Math.max(40, 100 - (miles / Math.max(maxMiles, 1)) * 40);
  }

  return Math.max(0, 40 - (miles - maxMiles) * 2);
}

function scoreDatingIntentionFit(
  viewerPrefs: Partial<DatingPreferences>,
  viewer: UserProfile,
  partner: UserProfile,
): number {
  const preferred = viewerPrefs.preferredLookingFor ?? [];
  const partnerGoals = partner.lookingFor ?? [];
  if (preferred.length === 0) {
    return Math.round(overlapRatio(viewer.lookingFor, partnerGoals) * 100);
  }
  return Math.round(overlapRatio(preferred, partnerGoals) * 100);
}

function scoreQueerRoleFit(
  viewerPrefs: Partial<DatingPreferences>,
  partner: UserProfile,
): number {
  const preferred = viewerPrefs.preferredQueerRoles ?? [];
  if (preferred.length === 0) {
    return partner.queerRoles.length > 0 ? 70 : 50;
  }
  return Math.round(overlapRatio(preferred, partner.queerRoles) * 100);
}

function scorePresentationFit(
  viewerPrefs: Partial<DatingPreferences>,
  partner: UserProfile,
): number {
  const preferred = viewerPrefs.preferredPresentationTags ?? [];
  if (preferred.length === 0) {
    return partner.presentationTags.length > 0 ? 70 : 50;
  }
  return Math.round(overlapRatio(preferred, partner.presentationTags) * 100);
}

function scorePersonalityVibeFit(partner: UserProfile, other: UserProfile): number {
  return Math.round(overlapRatio(partner.personalityTags, other.personalityTags) * 100);
}

function scoreLifestyleFit(
  viewerPrefs: Partial<DatingPreferences>,
  viewer: UserProfile,
  partner: UserProfile,
): number {
  if (hasDealbreakerHit(viewerPrefs, partner)) {
    return 0;
  }

  const niceHits =
    viewerPrefs.niceToHaves?.filter(
      (tag) => partner.lifestyleTags.includes(tag) || partner.personalityTags.includes(tag),
    ).length ?? 0;

  const base = Math.round(overlapRatio(viewer.lifestyleTags, partner.lifestyleTags) * 70);
  return Math.min(100, base + niceHits * 15);
}

function scoreAppearanceFit(
  viewerId: string,
  partnerId: string,
  context?: MatchingContext,
): number {
  const viewerScores = context?.appearanceScoresByViewer?.get(viewerId);
  if (!viewerScores) {
    return NEUTRAL_APPEARANCE_SCORE;
  }
  return viewerScores.get(partnerId) ?? NEUTRAL_APPEARANCE_SCORE;
}

function scoreCategory(
  category: MatchingPriorityCategory,
  viewer: UserProfile,
  viewerPrefs: Partial<DatingPreferences>,
  partner: UserProfile,
  context?: MatchingContext,
): number {
  switch (category) {
    case 'ageFit':
      return scoreAgeFit(viewerPrefs, partner);
    case 'distanceFit':
      return scoreDistanceFit(viewerPrefs, viewer, partner);
    case 'datingIntentionFit':
      return scoreDatingIntentionFit(viewerPrefs, viewer, partner);
    case 'queerRoleFit':
      return scoreQueerRoleFit(viewerPrefs, partner);
    case 'presentationFit':
      return scorePresentationFit(viewerPrefs, partner);
    case 'heightFit':
      return scoreHeightFit(viewerPrefs, partner);
    case 'personalityVibeFit':
      return scorePersonalityVibeFit(viewer, partner);
    case 'lifestyleFit':
      return scoreLifestyleFit(viewerPrefs, viewer, partner);
    case 'appearanceFit':
      return scoreAppearanceFit(viewer.id, partner.id, context);
    default:
      return 50;
  }
}

function collectHardBlockers(input: {
  profileA: UserProfile;
  prefsA: Partial<DatingPreferences>;
  profileB: UserProfile;
  prefsB: Partial<DatingPreferences>;
  blockedA: Set<string>;
  blockedB: Set<string>;
  context?: MatchingContext;
}): string[] {
  const blockers: string[] = [];
  const { profileA, profileB, prefsA, prefsB } = input;

  if (profileA.id === profileB.id) {
    blockers.push('Cannot match the same user');
  }

  if (input.blockedA.has(profileB.id) || input.blockedB.has(profileA.id)) {
    blockers.push('Blocked relationship');
  }

  const key = pairKey(profileA.id, profileB.id);
  if (input.context?.recentPairKeys?.has(key)) {
    blockers.push('Recent repeat date');
  }

  if (input.context?.reportedPairKeys?.has(key)) {
    blockers.push('Reported relationship');
  }

  if (!passesOrientationFilter(prefsA, profileB)) {
    blockers.push('Orientation mismatch for A');
  }
  if (!passesOrientationFilter(prefsB, profileA)) {
    blockers.push('Orientation mismatch for B');
  }

  if (hasDealbreakerHit(prefsA, profileB)) {
    blockers.push('Dealbreaker for A');
  }
  if (hasDealbreakerHit(prefsB, profileA)) {
    blockers.push('Dealbreaker for B');
  }

  if (exceedsMaxDistance(prefsA, profileA, profileB)) {
    blockers.push('Distance outside A maximum');
  }
  if (exceedsMaxDistance(prefsB, profileB, profileA)) {
    blockers.push('Distance outside B maximum');
  }

  return blockers;
}

export function scoreDirectionalFit(input: {
  viewer: UserProfile;
  viewerPrefs: Partial<DatingPreferences>;
  partner: UserProfile;
  context?: MatchingContext;
}): { score: number; reasons: string[] } {
  const order = normalizeMatchingPriorityOrder(
    input.viewerPrefs.matchingPriorityOrder ?? DEFAULT_MATCHING_PRIORITY_ORDER,
  );
  const weights = priorityWeights(order);
  const reasons: string[] = [];
  let score = 0;

  for (const category of order) {
    const categoryScore = scoreCategory(
      category,
      input.viewer,
      input.viewerPrefs,
      input.partner,
      input.context,
    );
    score += weights[category] * categoryScore;

    if (categoryScore >= 75) {
      reasons.push(`${category} strong`);
    }
  }

  return { score: Math.round(Math.min(100, Math.max(0, score))), reasons };
}

export function scoreMutualFit(
  scoreAtoB: number,
  scoreBtoA: number,
): number {
  const avg = (scoreAtoB + scoreBtoA) / 2;
  const floor = Math.min(scoreAtoB, scoreBtoA);

  if (floor < 35) {
    return Math.round(avg * 0.55 + floor * 0.2);
  }
  if (floor < 50) {
    return Math.round(avg * 0.82 + floor * 0.12);
  }

  return Math.round(avg);
}

export function evaluateCompatibility(input: {
  userA: { profile: UserProfile; preferences: Partial<DatingPreferences> };
  userB: { profile: UserProfile; preferences: Partial<DatingPreferences> };
  blockedA: Set<string>;
  blockedB: Set<string>;
  context?: MatchingContext;
}): CompatibilityResult {
  const { profile: profileA, preferences: prefsA } = input.userA;
  const { profile: profileB, preferences: prefsB } = input.userB;

  const blockers = collectHardBlockers({
    profileA,
    prefsA,
    profileB,
    prefsB,
    blockedA: input.blockedA,
    blockedB: input.blockedB,
    context: input.context,
  });

  if (blockers.length > 0) {
    const result: CompatibilityResult = {
      compatible: false,
      score: 0,
      reasons: [],
      blockers,
    };

    logMatchDecision({
      viewerId: profileA.id,
      partnerId: profileB.id,
      compatible: false,
      score: 0,
      blockers,
      reasons: [],
    });

    return result;
  }

  const aToB = scoreDirectionalFit({
    viewer: profileA,
    viewerPrefs: prefsA,
    partner: profileB,
    context: input.context,
  });
  const bToA = scoreDirectionalFit({
    viewer: profileB,
    viewerPrefs: prefsB,
    partner: profileA,
    context: input.context,
  });

  const score = scoreMutualFit(aToB.score, bToA.score);
  const reasons = [...new Set([...aToB.reasons, ...bToA.reasons])];

  const result: CompatibilityResult = {
    compatible: true,
    score,
    reasons,
    blockers: [],
  };

  logMatchDecision({
    viewerId: profileA.id,
    partnerId: profileB.id,
    compatible: true,
    score,
    blockers: [],
    reasons,
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
  context?: MatchingContext,
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
        context,
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
