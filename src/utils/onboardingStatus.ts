import type { DatingPreferences, UserProfile } from '../types';

/** Core profile fields saved to the account (used to resume onboarding vs. restart). */
export function hasSavedProfileBasics(profile: Partial<UserProfile>): boolean {
  const name = profile.name?.trim() ?? '';
  const age = profile.age ?? 0;
  const location = profile.location?.trim() ?? '';
  const height = profile.heightInches ?? 0;
  return (
    name.length > 0 &&
    age >= 18 &&
    location.length > 0 &&
    height > 0 &&
    Boolean(profile.genderIdentity)
  );
}

/** Profile fields required before preferences (photos optional for now). */
export function isProfileComplete(profile: Partial<UserProfile>): boolean {
  return (
    hasSavedProfileBasics(profile) && (profile.datingIntentions?.length ?? 0) > 0
  );
}

/** User has filled in required match preferences. */
export function isPreferencesComplete(prefs: Partial<DatingPreferences>): boolean {
  return (prefs.preferredLookingFor?.length ?? 0) > 0;
}

/** Returning login — profile + prefs already on the account. */
export function isReturningAccountReady(
  profile: Partial<UserProfile>,
  prefs: Partial<DatingPreferences>,
): boolean {
  return hasSavedProfileBasics(profile) && isPreferencesComplete(prefs);
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
  if (input.isOnboarded || isReturningAccountReady(input.profile, input.preferences)) {
    return 'SpeedDateLobby';
  }
  if (!hasSavedProfileBasics(input.profile)) {
    return 'ProfileCreation';
  }
  if (!isPreferencesComplete(input.preferences)) {
    return 'Preferences';
  }
  if (!isProfileComplete(input.profile)) {
    return 'ProfileCreation';
  }
  return 'Verification';
}
