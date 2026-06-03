import type {
  GenderIdentity,
  LookingFor,
  QueerPreference,
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
  { value: 'dates', label: 'Dates', description: 'Open to going out and seeing where it goes' },
  { value: 'relationship', label: 'Relationship', description: 'Looking for something meaningful' },
  { value: 'friends', label: 'Friends', description: 'Queer community and platonic connection' },
  { value: 'casual', label: 'Casual', description: 'Low-pressure, no strings attached' },
  { value: 'unsure', label: 'Unsure', description: 'Still figuring out what I want' },
];

export const QUEER_PREFERENCE_OPTIONS: { value: QueerPreference; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'verse', label: 'Verse' },
  { value: 'side', label: 'Side' },
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
];

export const HEIGHT_OPTIONS = Array.from({ length: 25 }, (_, i) => {
  const totalInches = 54 + i;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return {
    value: totalInches,
    label: `${feet}'${inches}"`,
  };
});

export const DISTANCE_OPTIONS = [
  { value: 5, label: '5 miles' },
  { value: 10, label: '10 miles' },
  { value: 25, label: '25 miles' },
  { value: 50, label: '50 miles' },
  { value: 100, label: '100+ miles' },
];
