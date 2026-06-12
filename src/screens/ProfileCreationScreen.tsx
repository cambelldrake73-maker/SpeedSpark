import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  ChipGrid,
  FormErrorBanner,
  HeightFields,
  Input,
  LocationSetting,
  OnboardingStep,
  PhotoPickerPlaceholder,
  ScreenContainer,
  SectionHeader,
  TagSelector,
  AuthFlowLogo,
} from '../components';
import {
  GENDER_OPTIONS,
  LIFESTYLE_TAG_MAX,
  LOOKING_FOR_OPTIONS,
  ORIENTATION_OPTIONS,
  LIFESTYLE_TAG_OPTIONS,
  normalizeLifestyleTags,
  PRESENTATION_OPTIONS,
} from '../constants/options';
import { spacing } from '../constants/theme';
import {
  ONBOARDING_TOTAL_STEPS,
  onboardingStepForProfileWizard,
} from '../constants/onboardingProgress';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { syncProfilePhotoSlots } from '../services/profilePhotos';
import { isSupabaseConfigured } from '../services/supabaseEnv';
import { formatAuthErrorForUser } from '../utils/authErrors';
import type { GenderIdentity, LookingFor, PresentationTag, SexualOrientation } from '../types';
import type { ProfileCreationScreenProps } from '../navigation/types';
import {
  inchesToFeetInches,
  parseFeetInchesFields,
  validateFeetInchesFields,
} from '../utils/heightFormat';
import type { ResolvedLocation } from '../utils/deviceLocation';

const MAX_PHOTOS = 6;
const REQUIRED_PHOTOS = 3;
const PROFILE_WIZARD_STEPS = 4;
const USE_NATIVE_PROFILE_STEPS = Platform.OS === 'ios' || Platform.OS === 'android';

/** Native wizard always scrolls — avoids flex/keyboard clashes on About you. */
const PROFILE_SCROLL_STEPS = new Set([0, 1, 2, 3]);

type ProfileField = 'photos' | 'name' | 'age' | 'location' | 'height';

function getProfileValidation(
  input: {
    name: string;
    age: string;
    deviceLocation: ResolvedLocation | null;
    heightFeet: string;
    heightInches: string;
    photos: string[];
  },
  options?: { requirePhotos?: boolean },
) {
  const requirePhotos = options?.requirePhotos ?? true;
  const errors: Partial<Record<ProfileField, string>> = {};
  const banner: string[] = [];

  const photoCount = input.photos.filter(Boolean).length;
  if (requirePhotos && photoCount < REQUIRED_PHOTOS) {
    const message = `Add at least ${REQUIRED_PHOTOS} photos (${photoCount}/${REQUIRED_PHOTOS} added)`;
    errors.photos = message;
    banner.push(message);
  }

  if (!input.name.trim()) {
    errors.name = 'Enter your display name';
    banner.push('Enter your display name');
  }

  const ageNum = parseInt(input.age, 10);
  if (!ageNum || ageNum < 18) {
    errors.age = 'Enter an age of 18 or older';
    banner.push('Enter an age of 18 or older');
  }

  if (!input.deviceLocation) {
    errors.location = 'Tap "Use my location" to set your city';
    banner.push('Set your location with "Use my location"');
  }

  const heightError = validateFeetInchesFields(input.heightFeet, input.heightInches);
  if (heightError) {
    errors.height = heightError;
    banner.push(heightError);
  }

  return { errors, banner };
}

function getProfileStepValidation(
  step: number,
  input: Parameters<typeof getProfileValidation>[0],
  options?: Parameters<typeof getProfileValidation>[1],
) {
  const full = getProfileValidation(input, options);
  const stepFields: Record<number, ProfileField[]> = {
    0: ['name', 'age', 'location', 'height'],
    1: ['photos'],
    2: [],
    3: [],
  };
  const allowed = new Set(stepFields[step] ?? []);
  const errors: Partial<Record<ProfileField, string>> = {};
  const banner: string[] = [];

  for (const field of allowed) {
    if (full.errors[field]) {
      errors[field] = full.errors[field];
      banner.push(full.errors[field]!);
    }
  }

  return { errors, banner };
}

const STEP_TITLES = [
  'About you',
  'Your photos',
  'Who you are',
  'How you show up',
];

const STEP_SUBTITLES = [
  undefined,
  'Add photos for your profile.',
  undefined,
  undefined,
];

export function ProfileCreationScreen({ navigation }: ProfileCreationScreenProps) {
  const { onboarding, updateProfile, saveProfileToServer } = useApp();
  const { session } = useAuth();
  const profile = onboarding.profile;
  const photosOptional = isSupabaseConfigured;

  const [wizardStep, setWizardStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [stepAttempted, setStepAttempted] = useState(false);
  const [name, setName] = useState(profile.name ?? '');
  const accountAge = onboarding.account?.age ?? profile.age ?? 0;
  const age = accountAge > 0 ? String(accountAge) : '';
  const [deviceLocation, setDeviceLocation] = useState<ResolvedLocation | null>(() => {
    if (
      profile.location &&
      profile.locationLatitude != null &&
      profile.locationLongitude != null
    ) {
      return {
        label: profile.location,
        latitude: profile.locationLatitude,
        longitude: profile.locationLongitude,
      };
    }
    return null;
  });
  const initialHeight = profile.heightInches
    ? inchesToFeetInches(profile.heightInches)
    : { feet: '', inches: '' };
  const [heightFeet, setHeightFeet] = useState(initialHeight.feet);
  const [heightInches, setHeightInches] = useState(initialHeight.inches);
  const [genderIdentity, setGenderIdentity] = useState<GenderIdentity>(
    profile.genderIdentity ?? 'prefer_not_to_say',
  );
  const [sexualOrientation, setSexualOrientation] = useState<SexualOrientation>(
    profile.sexualOrientation ?? 'prefer_not_to_say',
  );
  const [datingIntentions, setDatingIntentions] = useState<LookingFor[]>(
    profile.datingIntentions ?? [],
  );
  const [presentationTags, setPresentationTags] = useState<PresentationTag[]>(
    profile.presentationTags ?? [],
  );
  const [lifestyleTags, setLifestyleTags] = useState<string[]>(() =>
    normalizeLifestyleTags(profile.lifestyleTags, profile.personalityTags),
  );
  const [photos, setPhotos] = useState<string[]>(() =>
    Array.from({ length: MAX_PHOTOS }, (_, i) => profile.photos?.[i] ?? ''),
  );

  const validationInput = useMemo(
    () => ({
      name,
      age,
      deviceLocation,
      heightFeet,
      heightInches,
      photos,
    }),
    [name, age, deviceLocation, heightFeet, heightInches, photos],
  );

  const validationOptions = useMemo(
    () => ({ requirePhotos: !photosOptional }),
    [photosOptional],
  );

  const validation = useMemo(
    () => getProfileValidation(validationInput, validationOptions),
    [validationInput, validationOptions],
  );

  const stepValidation = useMemo(
    () =>
      USE_NATIVE_PROFILE_STEPS
        ? getProfileStepValidation(wizardStep, validationInput, validationOptions)
        : validation,
    [wizardStep, validationInput, validationOptions, validation],
  );

  const showErrors = USE_NATIVE_PROFILE_STEPS ? stepAttempted : submitAttempted;
  const fieldErrors = showErrors ? stepValidation.errors : {};
  const bannerMessages = [
    ...(showErrors ? stepValidation.banner : []),
    ...(saveError ? [saveError] : []),
  ];

  const toggle = <T extends string>(list: T[], value: T, setter: (v: T[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const finishProfile = async () => {
    setSubmitAttempted(true);
    setSaveError(null);

    const result = getProfileValidation(validationInput, validationOptions);
    if (result.banner.length > 0) return;

    if (datingIntentions.length === 0) {
      setSaveError('Select at least one dating intention');
      return;
    }

    const ageNum = parseInt(age, 10);
    const parsedHeight = parseFeetInchesFields(heightFeet, heightInches)!;
    const userId = profile.id || session?.user?.id;

    const profileUpdates = {
      id: userId,
      name: name.trim(),
      age: ageNum,
      location: deviceLocation!.label,
      locationLatitude: deviceLocation!.latitude,
      locationLongitude: deviceLocation!.longitude,
      heightInches: parsedHeight,
      photos: photos.filter(Boolean),
      genderIdentity,
      sexualOrientation,
      datingIntentions,
      interestedInGenders: [],
      queerRoles: [],
      presentationTags,
      personalityTags: [],
      lifestyleTags,
    };

    updateProfile(profileUpdates);

    if (isSupabaseConfigured && userId) {
      setIsSaving(true);
      try {
        const saved = await saveProfileToServer(profileUpdates);
        const photoUrls = await syncProfilePhotoSlots(userId, photos);
        updateProfile({ ...saved, photos: photoUrls });
        navigation.navigate('Preferences');
      } catch (error) {
        setSaveError(formatAuthErrorForUser(error));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    navigation.navigate('Preferences');
  };

  const handleContinue = () => {
    if (USE_NATIVE_PROFILE_STEPS) {
      setStepAttempted(true);
      setSaveError(null);
      const result = getProfileStepValidation(wizardStep, validationInput, validationOptions);
      if (result.banner.length > 0) return;

      if (wizardStep === 2 && datingIntentions.length === 0) {
        setSaveError('Select at least one dating intention');
        return;
      }

      if (wizardStep < PROFILE_WIZARD_STEPS - 1) {
        setStepAttempted(false);
        setWizardStep((step) => step + 1);
        return;
      }

      void finishProfile();
      return;
    }

    void finishProfile();
  };

  const handleBack = () => {
    if (USE_NATIVE_PROFILE_STEPS && wizardStep > 0) {
      setStepAttempted(false);
      setSaveError(null);
      setWizardStep((step) => step - 1);
      return;
    }
    navigation.goBack();
  };

  const renderBasics = () => (
    <>
      <Input
        label="Display name"
        placeholder="What should we call you?"
        value={name}
        onChangeText={setName}
        error={fieldErrors.name}
      />
      <Input
        label="Age"
        placeholder="25"
        value={age}
        keyboardType="number-pad"
        locked
        hint={fieldErrors.age ? undefined : 'Set when you signed up — cannot be changed here'}
        error={fieldErrors.age}
      />
    </>
  );

  const renderLocation = () => (
    <>
      <LocationSetting
        value={deviceLocation}
        onChange={setDeviceLocation}
        error={fieldErrors.location}
      />
      <HeightFields
        label="Height"
        feet={heightFeet}
        inches={heightInches}
        onFeetChange={setHeightFeet}
        onInchesChange={setHeightInches}
        error={showErrors ? fieldErrors.height : undefined}
      />
    </>
  );

  const renderPhotos = (showHeader = true) => (
    <>
      {showHeader ? (
        <SectionHeader
          title="Photos"
          hint={
            photosOptional
              ? 'Photos are optional for now — add up to 6 if you like'
              : showErrors
                ? undefined
                : 'Tap any slot to upload or take a picture'
          }
          error={fieldErrors.photos}
        />
      ) : null}
      <PhotoPickerPlaceholder photos={photos} onPhotosChange={setPhotos} maxPhotos={MAX_PHOTOS} />
    </>
  );

  const renderAboutYou = () => (
    <>
      {renderBasics()}
      {renderLocation()}
    </>
  );

  const renderIdentity = () => (
    <View style={styles.tightStep}>
      <SectionHeader title="Gender identity" dense first />
      <TagSelector
        options={GENDER_OPTIONS}
        selected={[genderIdentity]}
        onToggle={(v) => setGenderIdentity(v)}
        multiSelect={false}
        compact
      />
      <SectionHeader title="Orientation" dense />
      <TagSelector
        options={ORIENTATION_OPTIONS}
        selected={[sexualOrientation]}
        onToggle={(v) => setSexualOrientation(v)}
        multiSelect={false}
        compact
      />
      <SectionHeader title="Dating intentions" dense />
      <TagSelector
        options={LOOKING_FOR_OPTIONS}
        selected={datingIntentions}
        onToggle={(v) => toggle(datingIntentions, v, setDatingIntentions)}
        compact
      />
    </View>
  );

  const renderTags = () => (
    <View style={styles.tightStep}>
      <SectionHeader title="Presentation" dense first />
      <TagSelector
        options={PRESENTATION_OPTIONS}
        selected={presentationTags}
        onToggle={(v) => toggle(presentationTags, v, setPresentationTags)}
        compact
      />
      <SectionHeader title="Lifestyle & values" dense />
      <ChipGrid
        options={LIFESTYLE_TAG_OPTIONS}
        selected={lifestyleTags}
        onToggle={(tag) => toggle(lifestyleTags, tag, setLifestyleTags)}
        maxSelect={LIFESTYLE_TAG_MAX}
      />
    </View>
  );

  const renderNativeStep = () => {
    switch (wizardStep) {
      case 0:
        return renderAboutYou();
      case 1:
        return renderPhotos(false);
      case 2:
        return renderIdentity();
      case 3:
      default:
        return renderTags();
    }
  };

  const renderScrollForm = () => (
    <>
      <SectionHeader
        title="Photos"
        hint={
          photosOptional
            ? 'Photos are optional for now — add up to 6 if you like'
            : showErrors
              ? undefined
              : 'Tap any slot to upload or take a picture'
        }
        error={fieldErrors.photos}
      />
      <PhotoPickerPlaceholder photos={photos} onPhotosChange={setPhotos} maxPhotos={MAX_PHOTOS} />
      {renderBasics()}
      {renderLocation()}
      {renderIdentity()}
      {renderTags()}
    </>
  );

  const nativeScroll = USE_NATIVE_PROFILE_STEPS && PROFILE_SCROLL_STEPS.has(wizardStep);
  const stepTitle = USE_NATIVE_PROFILE_STEPS ? STEP_TITLES[wizardStep] ?? 'Build your profile' : 'Build your profile';
  const stepSubtitle = USE_NATIVE_PROFILE_STEPS ? STEP_SUBTITLES[wizardStep] : undefined;
  const continueLabel = USE_NATIVE_PROFILE_STEPS
    ? wizardStep < PROFILE_WIZARD_STEPS - 1
      ? 'Continue'
      : 'Continue to match preferences'
    : 'Continue to match preferences';

  return (
    <ScreenContainer
      scroll={!USE_NATIVE_PROFILE_STEPS || nativeScroll}
      scrollToTopKey={USE_NATIVE_PROFILE_STEPS ? wizardStep : undefined}
      scrollToTopOnFocus
      contentStyle={styles.content}
    >
      {(!USE_NATIVE_PROFILE_STEPS || wizardStep === 0) && <AuthFlowLogo />}
      <OnboardingStep
        currentStep={
          USE_NATIVE_PROFILE_STEPS ? onboardingStepForProfileWizard(wizardStep) : 1
        }
        totalSteps={ONBOARDING_TOTAL_STEPS}
        title={stepTitle}
        dense={USE_NATIVE_PROFILE_STEPS && (wizardStep === 2 || wizardStep === 3)}
        subtitle={
          USE_NATIVE_PROFILE_STEPS
            ? stepSubtitle
            : 'Complete this before entering any date window. Add who you are and how you show up — match preferences come next.'
        }
      />

      {USE_NATIVE_PROFILE_STEPS ? renderNativeStep() : renderScrollForm()}

      <FormErrorBanner messages={bannerMessages} />
      <Button
        title={continueLabel}
        onPress={handleContinue}
        size="lg"
        style={styles.btn}
        loading={isSaving}
        disabled={isSaving}
      />
      <Button title="Back" onPress={handleBack} variant="ghost" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  btn: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  tightStep: {
    gap: spacing.xs,
  },
});
