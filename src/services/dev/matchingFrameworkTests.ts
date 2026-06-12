/**
 * Offline assertions for the v1 matching framework.
 * Run via Metro: await SpeedSparkMatchingDev.runMatchingFrameworkTests()
 */
import { DEFAULT_MATCHING_PRIORITY_ORDER } from '../../constants/matchingPriorities';
import type { DatingPreferences, GenderIdentity, UserProfile } from '../../types';
import {
  collectHardBlockers,
  evaluateCompatibility,
  passesGenderLookingForFilter,
  scoreDirectionalFit,
} from '../matchingService';

const NYC = { locationLatitude: 40.7128, locationLongitude: -74.006 };

function assert(condition: boolean, message: string, failures: string[]): void {
  if (!condition) {
    failures.push(message);
  }
}

function baseProfile(
  id: string,
  genderIdentity: GenderIdentity,
  overrides: Partial<UserProfile> = {},
): UserProfile {
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
    ...NYC,
    ...overrides,
  };
}

function basePrefs(preferredLookingFor: GenderIdentity[]): Partial<DatingPreferences> {
  return {
    ageRangeMin: 21,
    ageRangeMax: 40,
    heightMinInches: 60,
    heightMaxInches: 78,
    maxDistanceMiles: 50,
    preferredOrientations: [],
    preferredLookingFor,
    preferredQueerRoles: [],
    preferredPresentationTags: [],
    matchingPriorityOrder: [...DEFAULT_MATCHING_PRIORITY_ORDER],
  };
}

const emptyBlocked = new Set<string>();

export interface MatchingFrameworkTestReport {
  passed: number;
  failed: number;
  failures: string[];
}

export function runMatchingFrameworkTests(): MatchingFrameworkTestReport {
  const failures: string[] = [];
  let passed = 0;

  const pass = (label: string) => {
    passed += 1;
    console.log(`[SpeedSpark Matching Tests] ✓ ${label}`);
  };

  // 1. Woman-preferring user is not paired with a man
  {
    const womanSeeker = baseProfile('woman-seeker', 'woman');
    const manPartner = baseProfile('man-partner', 'man');
    const womanPrefs = basePrefs(['woman']);
    const manPrefs = basePrefs(['man', 'woman']);

    const result = evaluateCompatibility({
      userA: { profile: womanSeeker, preferences: womanPrefs },
      userB: { profile: manPartner, preferences: manPrefs },
      blockedA: emptyBlocked,
      blockedB: emptyBlocked,
    });

    assert(!result.compatible, '1. woman seeker + man partner should be incompatible', failures);
    assert(
      result.blockers.some((b) => b.includes('Gender looking-for mismatch for A')),
      '1. should cite gender mismatch for woman seeker',
      failures,
    );
    if (failures.length === 0 || result.compatible) {
      /* counted below */
    }
    if (!result.compatible) {
      pass('woman seeker not paired with man');
    }
  }

  // 2. Man-preferring user is not paired with a woman
  {
    const manSeeker = baseProfile('man-seeker', 'man');
    const womanPartner = baseProfile('woman-partner', 'woman');
    const manPrefs = basePrefs(['man']);
    const womanPrefs = basePrefs(['woman']);

    const result = evaluateCompatibility({
      userA: { profile: manSeeker, preferences: manPrefs },
      userB: { profile: womanPartner, preferences: womanPrefs },
      blockedA: emptyBlocked,
      blockedB: emptyBlocked,
    });

    assert(!result.compatible, '2. man seeker + woman partner should be incompatible', failures);
    assert(
      result.blockers.some((b) => b.includes('Gender looking-for mismatch for A')),
      '2. should cite gender mismatch for man seeker',
      failures,
    );
    if (!result.compatible) {
      pass('man seeker not paired with woman');
    }
  }

  // 3. Both directions must pass preferredLookingFor
  {
    const a = baseProfile('bi-a', 'woman');
    const b = baseProfile('bi-b', 'man');
    const aPrefs = basePrefs(['woman']);
    const bPrefs = basePrefs(['man']);

    assert(!passesGenderLookingForFilter(aPrefs, b), '3a. A cannot accept B gender', failures);
    assert(!passesGenderLookingForFilter(bPrefs, a), '3b. B cannot accept A gender', failures);

    const blockers = collectHardBlockers({
      profileA: a,
      prefsA: aPrefs,
      profileB: b,
      prefsB: bPrefs,
      blockedA: emptyBlocked,
      blockedB: emptyBlocked,
    });
    assert(
      blockers.filter((b) => b.includes('Gender looking-for mismatch')).length === 2,
      '3c. both directions should produce gender blockers',
      failures,
    );

    const mutualOk = baseProfile('ok-a', 'woman');
    const mutualOkB = baseProfile('ok-b', 'woman');
    const okPrefs = basePrefs(['woman', 'non_binary']);
    assert(
      passesGenderLookingForFilter(okPrefs, mutualOkB) &&
        passesGenderLookingForFilter(okPrefs, mutualOk),
      '3d. mutual woman preference should pass both ways',
      failures,
    );

    const mutualResult = evaluateCompatibility({
      userA: { profile: mutualOk, preferences: okPrefs },
      userB: { profile: mutualOkB, preferences: okPrefs },
      blockedA: emptyBlocked,
      blockedB: emptyBlocked,
    });
    assert(mutualResult.compatible, '3e. mutual gender prefs should be compatible', failures);

    if (
      !passesGenderLookingForFilter(aPrefs, b) &&
      !passesGenderLookingForFilter(bPrefs, a) &&
      mutualResult.compatible
    ) {
      pass('bidirectional preferredLookingFor enforced');
    }
  }

  // 4. Eligible users ranked by matchingPriorityOrder
  {
    const viewer = baseProfile('rank-viewer', 'woman', {
      datingIntentions: ['relationship'],
      presentationTags: ['fem'],
    });
    const partnerHighPres = baseProfile('rank-pres', 'woman', {
      datingIntentions: ['friends'],
      presentationTags: ['fem'],
    });
    const partnerHighIntent = baseProfile('rank-intent', 'woman', {
      datingIntentions: ['relationship'],
      presentationTags: ['masc'],
    });
    const prefsPresentationFirst = basePrefs(['woman']);
    prefsPresentationFirst.preferredPresentationTags = ['fem'];
    prefsPresentationFirst.matchingPriorityOrder = [
      'presentationFit',
      'datingIntentionFit',
      'ageFit',
      'distanceFit',
      'appearanceFit',
      'lifestyleFit',
      'heightFit',
    ];

    const prefsIntentFirst = basePrefs(['woman']);
    prefsIntentFirst.matchingPriorityOrder = [
      'datingIntentionFit',
      'presentationFit',
      'ageFit',
      'distanceFit',
      'appearanceFit',
      'lifestyleFit',
      'heightFit',
    ];

    const scorePresFirstToPres = scoreDirectionalFit({
      viewer,
      viewerPrefs: prefsPresentationFirst,
      partner: partnerHighPres,
    }).score;
    const scorePresFirstToIntent = scoreDirectionalFit({
      viewer,
      viewerPrefs: prefsPresentationFirst,
      partner: partnerHighIntent,
    }).score;

    const scoreIntentFirstToPres = scoreDirectionalFit({
      viewer,
      viewerPrefs: prefsIntentFirst,
      partner: partnerHighPres,
    }).score;
    const scoreIntentFirstToIntent = scoreDirectionalFit({
      viewer,
      viewerPrefs: prefsIntentFirst,
      partner: partnerHighIntent,
    }).score;

    assert(
      scorePresFirstToPres > scorePresFirstToIntent,
      '4a. presentation-first rank should prefer presentation overlap',
      failures,
    );
    assert(
      scoreIntentFirstToIntent > scoreIntentFirstToPres,
      '4b. intention-first rank should prefer intention overlap',
      failures,
    );

    if (
      scorePresFirstToPres > scorePresFirstToIntent &&
      scoreIntentFirstToIntent > scoreIntentFirstToPres
    ) {
      pass('priority order affects directional ranking');
    }
  }

  // 5. appearanceFit private — not in public reasons
  {
    const a = baseProfile('appear-a', 'woman');
    const b = baseProfile('appear-b', 'woman');
    const prefs = basePrefs(['woman']);
    const context = {
      appearanceScoresByViewer: new Map([
        [a.id, new Map([[b.id, 95]])],
        [b.id, new Map([[a.id, 90]])],
      ]),
    };

    const aToB = scoreDirectionalFit({
      viewer: a,
      viewerPrefs: prefs,
      partner: b,
      context,
    });
    const result = evaluateCompatibility({
      userA: { profile: a, preferences: prefs },
      userB: { profile: b, preferences: prefs },
      blockedA: emptyBlocked,
      blockedB: emptyBlocked,
      context,
    });

    assert(
      aToB.categoryScores.appearanceFit === 95,
      '5a. appearanceFit should score internally',
      failures,
    );
    assert(
      !aToB.reasons.some((r) => r.includes('appearanceFit')),
      '5b. directional reasons must not mention appearanceFit',
      failures,
    );
    assert(
      !result.reasons.some((r) => r.includes('appearanceFit')),
      '5c. mutual reasons must not mention appearanceFit',
      failures,
    );
    assert(
      !result.reasons.some((r) => r.toLowerCase().includes('attractiveness')),
      '5d. mutual reasons must not mention attractiveness',
      failures,
    );

    if (aToB.categoryScores.appearanceFit === 95 && !result.reasons.some((r) => r.includes('appearance'))) {
      pass('appearanceFit remains private (internal scores only)');
    }
  }

  // Account status gate
  {
    const active = baseProfile('active-user', 'woman');
    const suspended = baseProfile('suspended-user', 'woman', { accountStatus: 'suspended' });
    const prefs = basePrefs(['woman']);

    const blockers = collectHardBlockers({
      profileA: active,
      prefsA: prefs,
      profileB: suspended,
      prefsB: prefs,
      blockedA: emptyBlocked,
      blockedB: emptyBlocked,
    });
    assert(blockers.some((b) => b.includes('Account B not active')), 'account status gate', failures);
    if (blockers.some((b) => b.includes('Account B not active'))) {
      pass('inactive account blocked');
    }
  }

  const failed = failures.length;
  if (failed > 0) {
    console.error('[SpeedSpark Matching Tests] FAILURES:', failures);
  } else {
    console.log(`[SpeedSpark Matching Tests] All ${passed} checks passed.`);
  }

  return { passed, failed, failures };
}
