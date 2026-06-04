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

export const PRESENTATION_OPTIONS: { value: PresentationTag; label: string }[] = [
  { value: 'masc', label: 'Masc' },
  { value: 'fem', label: 'Fem' },
  { value: 'no_label', label: 'No label' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const PERSONALITY_TAGS = [
  'Introvert',
  'Extrovert',
  'Creative',
  'Outdoorsy',
  'Foodie',
  'Bookworm',
  'Night owl',
  'Early bird',
  'Spiritual',
  'Activist',
  'Gamer',
  'Fitness',
  'Chill',
  'Adventurous',
  'Homebody',
  'Music lover',
  'Dog person',
  'Cat person',
  'Romantic',
  'Direct communicator',
];

/** Self-selected on profile — dealbreakers must come from this list only */
export const LIFESTYLE_TAG_OPTIONS = [
  'Non-smoker',
  'Smoker',
  'Sober',
  'Social drinker',
  'Heavy drinker',
  'Wants kids someday',
  'Open to kids',
  "Doesn't want kids",
  'Monogamous',
  'Non-monogamous',
  'Out and proud',
  'Not out yet',
];

/** Traits a match can list on their profile that you want to avoid */
export const DEALBREAKER_OPTIONS: string[] = [
  'Smoker',
  'Heavy drinker',
  'Not out yet',
  'Wants kids someday',
  "Doesn't want kids",
  'Non-monogamous',
];

/** Must match personality tags, lifestyle tags, or verified status on a profile */
export const NICE_TO_HAVE_OPTIONS: string[] = [
  'Verified profile',
  'Romantic',
  'Direct communicator',
  'Activist',
  'Night owl',
  'Early bird',
  'Chill',
  'Creative',
  'Monogamous',
  'Open to kids',
  'Non-smoker',
  'Sober',
  'Out and proud',
];

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
  { value: 'masc', label: 'Masc' },
  { value: 'fem', label: 'Fem' },
  { value: 'no_label', label: 'No clear label' },
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
    'SpeedSpark goes live during scheduled date windows only — not 24/7. Drop in when a window opens.',
};
