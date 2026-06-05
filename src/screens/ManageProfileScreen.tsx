import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  ChipGrid,
  FormErrorBanner,
  HeightFields,
  Input,
  LocationSetting,
  PhotoPickerPlaceholder,
  ScreenContainer,
  SectionHeader,
  TagSelector,
} from '../components';
import {
  GENDER_OPTIONS,
  LIFESTYLE_TAG_OPTIONS,
  LOOKING_FOR_OPTIONS,
  ORIENTATION_OPTIONS,
  PERSONALITY_TAGS,
  PRESENTATION_OPTIONS,
} from '../constants/options';
import { colors, spacing, typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { syncProfilePhotoSlots } from '../services/profilePhotos';
import { isSupabaseConfigured } from '../services/supabaseEnv';
import { formatAuthErrorForUser } from '../utils/authErrors';
import type {
  GenderIdentity,
  LookingFor,
  PresentationTag,
  SexualOrientation,
} from '../types';
import type { ManageProfileScreenProps } from '../navigation/types';
import {
  inchesToFeetInches,
  parseFeetInchesFields,
  validateFeetInchesFields,
} from '../utils/heightFormat';
import type { ResolvedLocation } from '../utils/deviceLocation';

const MAX_PHOTOS = 6;
const REQUIRED_PHOTOS = 3;

export function ManageProfileScreen({ navigation }: ManageProfileScreenProps) {
  const { session } = useAuth();
  const { currentUser, updateCurrentUser, saveProfileToServer } = useApp();
  const profile = currentUser;

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [name, setName] = useState(profile.name ?? '');
  const [age, setAge] = useState(profile.age ? String(profile.age) : '');
  const [deviceLocation, setDeviceLocation] = useState<ResolvedLocation | null>(() => {
    if (profile.location && profile.locationLatitude != null && profile.locationLongitude != null) {
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
  const [personalityTags, setPersonalityTags] = useState<string[]>(profile.personalityTags ?? []);
  const [lifestyleTags, setLifestyleTags] = useState<string[]>(profile.lifestyleTags ?? []);
  const [photos, setPhotos] = useState<string[]>(() =>
    Array.from({ length: MAX_PHOTOS }, (_, i) => profile.photos?.[i] ?? ''),
  );

  const validation = useMemo(() => {
    const errors: string[] = [];
    const photoCount = photos.filter(Boolean).length;
    if (photoCount < REQUIRED_PHOTOS) {
      errors.push(`Add at least ${REQUIRED_PHOTOS} photos (${photoCount}/${REQUIRED_PHOTOS})`);
    }
    if (!name.trim()) errors.push('Enter your name');
    const ageNum = parseInt(age, 10);
    if (!ageNum || ageNum < 18) errors.push('Enter an age of 18 or older');
    if (!deviceLocation) errors.push('Set your location');
    const heightError = validateFeetInchesFields(heightFeet, heightInches);
    if (heightError) errors.push(heightError);
    if (lookingFor.length === 0) errors.push('Select at least one "Looking for" option');
    return errors;
  }, [photos, name, age, deviceLocation, heightFeet, heightInches, lookingFor]);

  const toggle = <T extends string>(list: T[], value: T, setter: (v: T[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleSave = async () => {
    setSubmitAttempted(true);
    setSaveError(null);
    if (validation.length > 0) return;

    const parsedHeight = parseFeetInchesFields(heightFeet, heightInches)!;
    const userId = session?.user?.id ?? profile.id;
    const profileUpdates = {
      name: name.trim(),
      age: parseInt(age, 10),
      location: deviceLocation!.label,
      locationLatitude: deviceLocation!.latitude,
      locationLongitude: deviceLocation!.longitude,
      heightInches: parsedHeight,
      genderIdentity,
      sexualOrientation,
      lookingFor,
      presentationTags,
      personalityTags,
      lifestyleTags,
    };

    if (!isSupabaseConfigured || !userId || userId === 'user-1') {
      updateCurrentUser({
        ...profileUpdates,
        photos: photos.filter(Boolean),
      });
      navigation.goBack();
      return;
    }

    setIsSaving(true);
    try {
      const photoUrls = await syncProfilePhotoSlots(userId, photos);
      const saved = await saveProfileToServer({ ...profileUpdates, id: userId, photos: photoUrls });
      updateCurrentUser(saved);
      navigation.goBack();
    } catch (error) {
      setSaveError(formatAuthErrorForUser(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Manage profile</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.subtitle}>
        Update what others see after a speed date. Your private ratings are never shown here.
      </Text>

      <SectionHeader title="Photos" hint={`At least ${REQUIRED_PHOTOS} photos required`} />
      <PhotoPickerPlaceholder photos={photos} onPhotosChange={setPhotos} maxPhotos={MAX_PHOTOS} />

      <SectionHeader title="Basics" />
      <Input label="Name" value={name} onChangeText={setName} placeholder="Display name" />
      <Input
        label="Age"
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
        placeholder="25"
      />
      <LocationSetting value={deviceLocation} onChange={setDeviceLocation} />
      <HeightFields
        label="Height"
        feet={heightFeet}
        inches={heightInches}
        onFeetChange={setHeightFeet}
        onInchesChange={setHeightInches}
      />

      <SectionHeader title="Gender identity" />
      <TagSelector
        options={GENDER_OPTIONS}
        selected={[genderIdentity]}
        onToggle={setGenderIdentity}
        multiSelect={false}
      />

      <SectionHeader title="Sexual orientation" />
      <TagSelector
        options={ORIENTATION_OPTIONS}
        selected={[sexualOrientation]}
        onToggle={setSexualOrientation}
        multiSelect={false}
      />

      <SectionHeader title="Looking for" />
      <TagSelector
        options={LOOKING_FOR_OPTIONS}
        selected={lookingFor}
        onToggle={(v) => toggle(lookingFor, v, setLookingFor)}
      />

      <SectionHeader title="Presentation" />
      <TagSelector
        options={PRESENTATION_OPTIONS}
        selected={presentationTags}
        onToggle={(v) => toggle(presentationTags, v, setPresentationTags)}
      />

      <SectionHeader title="Vibe & personality" hint="Pick up to 6 tags" />
      <ChipGrid
        options={PERSONALITY_TAGS}
        selected={personalityTags}
        onToggle={(tag) => toggle(personalityTags, tag, setPersonalityTags)}
        maxSelect={6}
      />

      <SectionHeader title="Lifestyle & values" hint="Pick up to 6 tags" />
      <ChipGrid
        options={LIFESTYLE_TAG_OPTIONS}
        selected={lifestyleTags}
        onToggle={(tag) => toggle(lifestyleTags, tag, setLifestyleTags)}
        maxSelect={6}
      />

      <FormErrorBanner
        messages={[...(submitAttempted ? validation : []), ...(saveError ? [saveError] : [])]}
      />
      <Button
        title="Save changes"
        onPress={() => void handleSave()}
        size="lg"
        style={styles.btn}
        loading={isSaving}
        disabled={isSaving}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  btn: {
    marginTop: spacing.lg,
  },
});
