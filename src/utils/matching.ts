import type { DateFeedback, DatingPreferences, UserProfile } from '../types';

export interface MatchCompatibility {
  score: number;
  highlights: string[];
}

/** Demo-only compatibility estimate — never exposes private match-fit scores. */
export function estimateCompatibility(
  viewer: Partial<UserProfile>,
  partner: UserProfile,
  prefs: Partial<DatingPreferences>,
): MatchCompatibility {
  const highlights: string[] = [];
  let score = 72;

  if (
    prefs.ageRangeMin &&
    prefs.ageRangeMax &&
    partner.age >= prefs.ageRangeMin &&
    partner.age <= prefs.ageRangeMax
  ) {
    score += 8;
    highlights.push('Within your preferred age range');
  }

  if (prefs.preferredLookingFor?.length) {
    const matchesInterest = prefs.preferredLookingFor.includes(partner.genderIdentity);
    if (matchesInterest) {
      score += 10;
      highlights.push('Matches who you want to meet');
    }
  }

  if (viewer.queerRoles?.length && partner.queerRoles?.length) {
    const roleOverlap = viewer.queerRoles.filter((r) => partner.queerRoles?.includes(r));
    if (roleOverlap.length > 0) {
      score += 6;
      highlights.push('Compatible queer roles');
    }
  }

  if (viewer.presentationTags?.length && partner.presentationTags?.length) {
    const presOverlap = viewer.presentationTags.filter((p) =>
      partner.presentationTags?.includes(p),
    );
    if (presOverlap.length > 0) {
      score += 4;
      highlights.push('Presentation vibe overlap');
    }
  }

  const tagOverlap =
    viewer.lifestyleTags?.filter((t) => partner.lifestyleTags.includes(t)) ?? [];
  if (tagOverlap.length > 0) {
    score += 5;
    highlights.push(`Shared values: ${tagOverlap.slice(0, 2).join(', ')}`);
  }

  if (partner.verificationStatus === 'verified') {
    highlights.push('Verified profile');
  }

  return {
    score: Math.min(98, score),
    highlights: highlights.slice(0, 4),
  };
}

/**
 * Applies private post-date attractiveness rating to refine future pairings.
 * Never exposed as a public score.
 */
export function refineCompatibilityFromFeedback(
  base: MatchCompatibility,
  feedback: DateFeedback,
): MatchCompatibility {
  let score = base.score;
  const highlights = [...base.highlights];

  if (feedback.attractivenessRating >= 8) {
    score += 6;
    if (!highlights.some((h) => h.includes('attractiveness'))) {
      highlights.push('Strong private attractiveness signal');
    }
  } else if (feedback.attractivenessRating >= 6) {
    score += 3;
  }

  return {
    score: Math.min(98, score),
    highlights: highlights.slice(0, 4),
  };
}

export function surveySignalsSummary(feedback: DateFeedback): string[] {
  return [`Rated ${feedback.attractivenessRating}/10 on attractiveness (private)`];
}
