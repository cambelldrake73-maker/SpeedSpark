import type { DatingPreferences, UserProfile } from '../types';

/** Profile fields required before preferences (photos optional for now). */
export function isProfileComplete(profile: Partial<UserProfile>): boolean {
  const name = profile.name?.trim() ?? '';
  const age = profile.age ?? 0;
  const location = profile.location?.trim() ?? '';
  const height = profile.heightInches ?? 0;
  const lookingFor = profile.lookingFor ?? [];

  return (
    name.length > 0 &&
    age >= 18 &&
    location.length > 0 &&
    height > 0 &&
    lookingFor.length > 0 &&
    Boolean(profile.genderIdentity) &&
    Boolean(profile.sexualOrientation)
  );
}

/** User has filled in match preferences beyond DB defaults. */
export function isPreferencesComplete(prefs: Partial<DatingPreferences>): boolean {
  const hasLookingFor = (prefs.preferredLookingFor?.length ?? 0) > 0;
  const hasOrientations = (prefs.preferredOrientations?.length ?? 0) > 0;
  const hasDealbreakers = (prefs.dealbreakers?.length ?? 0) > 0;
  const hasNiceToHaves = (prefs.niceToHaves?.length ?? 0) > 0;

  return hasLookingFor || hasOrientations || hasDealbreakers || hasNiceToHaves;
}

export type OnboardingRoute =
  | 'ProfileCreation'
  | 'Preferences'
  | 'Verification'
  | 'SpeedDateLobby';

export function resolveOnboardingRoute(input: {
  isOnboarded: boolean;
  profile: Partial<UserProfile>;
  preferences: Partial<DatingPreferences>;
}): OnboardingRoute {
  if (input.isOnboarded) {
    return 'SpeedDateLobby';
  }
  if (!isProfileComplete(input.profile)) {
    return 'ProfileCreation';
  }
  if (!isPreferencesComplete(input.preferences)) {
    return 'Preferences';
  }
  return 'Verification';
}
