import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
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
  BrandLogo,
} from '../components';
import {
  GENDER_OPTIONS,
  LIFESTYLE_TAG_OPTIONS,
  LOOKING_FOR_OPTIONS,
  ORIENTATION_OPTIONS,
  PERSONALITY_TAGS,
  PRESENTATION_OPTIONS,
} from '../constants/options';
import { spacing } from '../constants/theme';
import { useApp } from '../context/AppContext';
import type {
  GenderIdentity,
  LookingFor,
  PresentationTag,
  SexualOrientation,
} from '../types';
import type { ProfileCreationScreenProps } from '../navigation/types';
import {
  inchesToFeetInches,
  parseFeetInchesFields,
  validateFeetInchesFields,
} from '../utils/heightFormat';
import type { ResolvedLocation } from '../utils/deviceLocation';

const MAX_PHOTOS = 6;
const REQUIRED_PHOTOS = 3;

type ProfileField =
  | 'photos'
  | 'name'
  | 'age'
  | 'location'
  | 'height'
  | 'lookingFor';

function getProfileValidation(input: {
  name: string;
  age: string;
  deviceLocation: ResolvedLocation | null;
  heightFeet: string;
  heightInches: string;
  lookingFor: LookingFor[];
  photos: string[];
}) {
  const errors: Partial<Record<ProfileField, string>> = {};
  const banner: string[] = [];

  const photoCount = input.photos.filter(Boolean).length;
  if (photoCount < REQUIRED_PHOTOS) {
    const message = `Add at least ${REQUIRED_PHOTOS} photos (${photoCount}/${REQUIRED_PHOTOS} added)`;
    errors.photos = message;
    banner.push(message);
  }

  if (!input.name.trim()) {
    errors.name = 'Enter your name';
    banner.push('Enter your name');
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

  if (input.lookingFor.length === 0) {
    errors.lookingFor = 'Select at least one option';
    banner.push('Select at least one "Looking for" option');
  }

  return { errors, banner };
}

export function ProfileCreationScreen({ navigation }: ProfileCreationScreenProps) {
  const { onboarding, updateProfile } = useApp();
  const profile = onboarding.profile;

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [name, setName] = useState(profile.name ?? '');
  const [age, setAge] = useState(profile.age ? String(profile.age) : '');
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
  const [lookingFor, setLookingFor] = useState<LookingFor[]>(profile.lookingFor ?? []);
  const [presentationTags, setPresentationTags] = useState<PresentationTag[]>(
    profile.presentationTags ?? [],
  );
  const [personalityTags, setPersonalityTags] = useState<string[]>(
    profile.personalityTags ?? [],
  );
  const [lifestyleTags, setLifestyleTags] = useState<string[]>(profile.lifestyleTags ?? []);
  const [photos, setPhotos] = useState<string[]>(() =>
    Array.from({ length: MAX_PHOTOS }, (_, i) => profile.photos?.[i] ?? ''),
  );

  const validation = useMemo(
    () =>
      getProfileValidation({
        name,
        age,
        deviceLocation,
        heightFeet,
        heightInches,
        lookingFor,
        photos,
      }),
    [name, age, deviceLocation, heightFeet, heightInches, lookingFor, photos],
  );

  const showErrors = submitAttempted;
  const fieldErrors = showErrors ? validation.errors : {};
  const bannerMessages = showErrors ? validation.banner : [];

  const toggle = <T extends string>(list: T[], value: T, setter: (v: T[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleContinue = () => {
    setSubmitAttempted(true);

    const result = getProfileValidation({
      name,
      age,
      deviceLocation,
      heightFeet,
      heightInches,
      lookingFor,
      photos,
    });

    if (result.banner.length > 0) return;

    const ageNum = parseInt(age, 10);
    const parsedHeight = parseFeetInchesFields(heightFeet, heightInches)!;

    updateProfile({
      name: name.trim(),
      age: ageNum,
      location: deviceLocation!.label,
      locationLatitude: deviceLocation!.latitude,
      locationLongitude: deviceLocation!.longitude,
      heightInches: parsedHeight,
      photos: photos.filter(Boolean),
      genderIdentity,
      sexualOrientation,
      lookingFor,
      queerRoles: [],
      presentationTags,
      personalityTags,
      lifestyleTags,
    });
    navigation.navigate('Preferences');
  };

  const liveHeightError =
    heightFeet.trim() || heightInches.trim() || showErrors
      ? validateFeetInchesFields(heightFeet, heightInches)
      : null;

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <BrandLogo size="auth" style={styles.logo} />
      <OnboardingStep
        flowLabel="Required before you join"
        currentStep={1}
        totalSteps={3}
        title="Build your profile"
        subtitle="Complete this before entering any date window. Presentation, intentions, and who you're into — so you're never dumped in the wrong pool."
      />

      <SectionHeader
        title="Photos"
        hint={
          showErrors
            ? undefined
            : `Add at least ${REQUIRED_PHOTOS} photos — tap any slot to upload or take a picture`
        }
        error={fieldErrors.photos}
      />
      <PhotoPickerPlaceholder photos={photos} onPhotosChange={setPhotos} maxPhotos={MAX_PHOTOS} />

      <SectionHeader title="Basics" />
      <Input
        label="Name"
        placeholder="What should we call you?"
        value={name}
        onChangeText={setName}
        hint={fieldErrors.name ? undefined : 'Pre-filled from your account — change your display name anytime'}
        error={fieldErrors.name}
      />
      <Input
        label="Age"
        placeholder="25"
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
        hint={fieldErrors.age ? undefined : 'From your account — must be 18+'}
        error={fieldErrors.age}
      />
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
        error={showErrors ? fieldErrors.height : liveHeightError ?? undefined}
      />

      <SectionHeader title="Gender identity" />
      <TagSelector
        options={GENDER_OPTIONS}
        selected={[genderIdentity]}
        onToggle={(v) => setGenderIdentity(v)}
        multiSelect={false}
      />

      <SectionHeader title="Sexual orientation" />
      <TagSelector
        options={ORIENTATION_OPTIONS}
        selected={[sexualOrientation]}
        onToggle={(v) => setSexualOrientation(v)}
        multiSelect={false}
      />

      <SectionHeader
        title="Looking for"
        hint={
          showErrors
            ? undefined
            : 'Select all that apply — relationship-minded, platonic, and casual are all valid'
        }
        error={fieldErrors.lookingFor}
      />
      <TagSelector
        options={LOOKING_FOR_OPTIONS}
        selected={lookingFor}
        onToggle={(v) => toggle(lookingFor, v, setLookingFor)}
      />

      <SectionHeader
        title="Presentation"
        hint="Masc, fem, or no label — however you show up"
      />
      <TagSelector
        options={PRESENTATION_OPTIONS}
        selected={presentationTags}
        onToggle={(v) => toggle(presentationTags, v, setPresentationTags)}
      />

      <SectionHeader title="Vibe & personality" hint="Pick up to 6 tags that feel like you" />
      <ChipGrid
        options={PERSONALITY_TAGS}
        selected={personalityTags}
        onToggle={(tag) => toggle(personalityTags, tag, setPersonalityTags)}
        maxSelect={6}
      />

      <SectionHeader
        title="Lifestyle & values"
        hint="Honest tags about you — matches use these for dealbreakers and nice-to-haves"
      />
      <ChipGrid
        options={LIFESTYLE_TAG_OPTIONS}
        selected={lifestyleTags}
        onToggle={(tag) => toggle(lifestyleTags, tag, setLifestyleTags)}
        maxSelect={6}
      />

      <FormErrorBanner messages={bannerMessages} />
      <Button title="Continue to match preferences" onPress={handleContinue} size="lg" style={styles.btn} />
      <Button title="Back" onPress={() => navigation.goBack()} variant="ghost" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  logo: {
    marginBottom: spacing.lg,
  },
  btn: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
