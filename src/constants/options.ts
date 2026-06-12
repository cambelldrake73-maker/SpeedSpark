import type {
  GenderIdentity,
  LookingFor,
  PresentationTag,
  QueerRole,
  SexualOrientation,
} from '../types';

export const GENDER_OPTIONS: { value: GenderIdentity; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'genderqueer', label: 'Genderqueer' },
  { value: 'trans_woman', label: 'Trans woman' },
  { value: 'trans_man', label: 'Trans man' },
  { value: 'questioning', label: 'Questioning' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/** Who the member wants to meet — set in match preferences. */
export const INTERESTED_IN_GENDER_OPTIONS: { value: GenderIdentity; label: string }[] = [
  { value: 'man', label: 'Male' },
  { value: 'woman', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'genderqueer', label: 'Genderqueer' },
  { value: 'trans_woman', label: 'Trans woman' },
  { value: 'trans_man', label: 'Trans man' },
  { value: 'other', label: 'Other' },
];

export const ORIENTATION_OPTIONS: { value: SexualOrientation; label: string }[] = [
  { value: 'lesbian', label: 'Lesbian' },
  { value: 'gay', label: 'Gay' },
  { value: 'bisexual', label: 'Bisexual' },
  { value: 'pansexual', label: 'Pansexual' },
  { value: 'queer', label: 'Queer' },
  { value: 'asexual', label: 'Asexual' },
  { value: 'demisexual', label: 'Demisexual' },
  { value: 'questioning', label: 'Questioning' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const LOOKING_FOR_OPTIONS: { value: LookingFor; label: string; description: string }[] = [
  {
    value: 'dates',
    label: 'Dates',
    description: 'Open to going out and seeing where it goes',
  },
  {
    value: 'relationship',
    label: 'Relationship',
    description: 'Looking for something meaningful and ongoing',
  },
  {
    value: 'friends',
    label: 'Friends',
    description: 'Queer community, platonic connection, no romance required',
  },
  {
    value: 'casual',
    label: 'Casual',
    description: 'Low-pressure connection on your terms',
  },
  {
    value: 'unsure',
    label: 'Unsure',
    description: 'Still exploring what feels right',
  },
];

export const QUEER_ROLE_OPTIONS: { value: QueerRole; label: string; description?: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'verse', label: 'Verse' },
  { value: 'side', label: 'Side' },
  { value: 'no_label', label: 'No label' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const PRESENTATION_TAG_VALUES: PresentationTag[] = [
  'masc',
  'soft_masc',
  'fem',
  'soft_fem',
  'androgynous',
  'balanced_masc_fem',
  'gender_nonconforming',
];

export const PRESENTATION_OPTIONS: { value: PresentationTag; label: string }[] = [
  { value: 'masc', label: 'Masculine' },
  { value: 'soft_masc', label: 'Soft Masculine' },
  { value: 'fem', label: 'Feminine' },
  { value: 'soft_fem', label: 'Soft Feminine' },
  { value: 'androgynous', label: 'Androgynous' },
  { value: 'balanced_masc_fem', label: 'Balanced Masculine & Feminine' },
  { value: 'gender_nonconforming', label: 'Gender Nonconforming' },
];

const LEGACY_PRESENTATION_TAG_MAP: Record<string, PresentationTag> = {
  butch: 'masc',
  stud: 'masc',
  tomboy: 'soft_masc',
  femme: 'fem',
  high_fem: 'fem',
  stem: 'balanced_masc_fem',
  neutral: 'androgynous',
  fluid: 'androgynous',
  eclectic: 'gender_nonconforming',
};

/** Maps stored tags to the current presentation set (drops removed values). */
export function normalizePresentationTags(
  tags: string[] | null | undefined,
): PresentationTag[] {
  const seen = new Set<PresentationTag>();
  const normalized: PresentationTag[] = [];

  for (const tag of tags ?? []) {
    let mapped: PresentationTag | undefined;
    if (PRESENTATION_TAG_VALUES.includes(tag as PresentationTag)) {
      mapped = tag as PresentationTag;
    } else {
      mapped = LEGACY_PRESENTATION_TAG_MAP[tag];
    }
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped);
      normalized.push(mapped);
    }
  }

  return normalized;
}

/** Self-selected on profile */
export const LIFESTYLE_TAG_MAX = 5;

export const LIFESTYLE_TAG_OPTIONS = [
  'Fitness Focused',
  'Outdoorsy',
  'Traveler',
  'Homebody',
  'Foodie',
  'Nightlife Lover',
  'Sober',
  'Social Drinker',
  'Family Oriented',
  'Wants Kids Someday',
  'Monogamous',
  'Spiritual',
  'Creative',
  'Ambitious',
  'Curious',
  'Playful',
  'Funny',
  'Thoughtful',
  'Introvert',
  'Extrovert',
  'Bookworm',
  'Night owl',
  'Early bird',
  'Activist',
  'Gamer',
  'Fitness',
  'Chill',
  'Adventurous',
  'Music lover',
  'Dog person',
  'Cat person',
  'Romantic',
  'Direct communicator',
];

const LEGACY_LIFESTYLE_TAG_MAP: Record<string, string> = {
  'Social drinker': 'Social Drinker',
  'Wants kids someday': 'Wants Kids Someday',
};

/** Maps stored tags to the current lifestyle list (drops removed values). */
export function normalizeLifestyleTags(
  lifestyleTags: string[] | null | undefined,
  personalityTags?: string[] | null | undefined,
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  const combined = [...(lifestyleTags ?? []), ...(personalityTags ?? [])];

  for (const tag of combined) {
    let mapped = tag;
    if (!LIFESTYLE_TAG_OPTIONS.includes(tag)) {
      mapped = LEGACY_LIFESTYLE_TAG_MAP[tag] ?? '';
    }
    if (mapped && LIFESTYLE_TAG_OPTIONS.includes(mapped) && !seen.has(mapped)) {
      seen.add(mapped);
      normalized.push(mapped);
    }
  }

  return normalized.slice(0, LIFESTYLE_TAG_MAX);
}

/** Valid height range stored as total inches */
export const HEIGHT_MIN_INCHES = 48;
export const HEIGHT_MAX_INCHES = 84;

export const DISTANCE_OPTIONS = [
  { value: 5, label: '5 mi' },
  { value: 10, label: '10 mi' },
  { value: 25, label: '25 mi' },
  { value: 50, label: '50 mi' },
  { value: 100, label: '100+ mi' },
];

export const SPARK_SIGNAL_OPTIONS = [
  { value: 1, label: 'Not much spark' },
  { value: 2, label: 'A little spark' },
  { value: 3, label: 'Some spark' },
  { value: 4, label: 'Strong spark' },
  { value: 5, label: 'Very strong spark' },
];

/** Post-date survey — how you read their presentation */
export const PERCEIVED_PRESENTATION_OPTIONS: { value: PresentationTag; label: string }[] = [
  ...PRESENTATION_OPTIONS,
];

/** Post-date survey — private appearance balance (never shown as a number) */
export const APPEARANCE_SIGNAL_OPTIONS = [
  { value: 1, label: 'Not my type' },
  { value: 2, label: 'Neutral' },
  { value: 3, label: 'Attractive to me' },
  { value: 4, label: 'Very attractive to me' },
  { value: 5, label: 'Exactly my type' },
];

export const COPY = {
  matchFitPrivate:
    'After each date, you privately rate attractiveness from 1–10. It never appears on your profile — we use it internally to improve pairings.',
  surveyMatching:
    'One private question after each date: how attractive was this person to you? Your date never sees your answer.',
  sparkPrivate:
    'Your rating stays private — never a public score on anyone’s profile.',
  fiveMinute:
    'Each speed date is exactly 5 minutes. Be present, be kind, and trust your gut.',
  scheduledWindows:
    'SpeedSpark goes live during scheduled date windows only — not 24/7.',
};
