/** Profile wizard screens (native stepped flow). */
export const ONBOARDING_PROFILE_STEPS = 4;

/** Match preferences wizard screens (native onboarding only). */
export const ONBOARDING_PREFS_STEPS = 3;

/** Profile + preferences + identity verification. */
export const ONBOARDING_TOTAL_STEPS =
  ONBOARDING_PROFILE_STEPS + ONBOARDING_PREFS_STEPS + 1;

/** @deprecated Use onboardingStepForPrefsWizard — kept for settings-style single-page prefs. */
export const ONBOARDING_PREFS_STEP = ONBOARDING_PROFILE_STEPS + 1;

export const ONBOARDING_VERIFY_STEP = ONBOARDING_TOTAL_STEPS;

export function onboardingStepForProfileWizard(wizardStep: number): number {
  return wizardStep + 1;
}

export function onboardingStepForPrefsWizard(wizardStep: number): number {
  return ONBOARDING_PROFILE_STEPS + wizardStep + 1;
}
