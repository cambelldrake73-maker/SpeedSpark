import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Input,
  PhotoPickerPlaceholder,
  ProgressBar,
  ScreenContainer,
  TagSelector,
} from '../components';
import {
  GENDER_OPTIONS,
  HEIGHT_OPTIONS,
  LOOKING_FOR_OPTIONS,
  ORIENTATION_OPTIONS,
  PERSONALITY_TAGS,
  QUEER_PREFERENCE_OPTIONS,
} from '../constants/options';
import { colors, spacing, typography } from '../constants/theme';
import { useApp } from '../context/AppContext';
import type {
  GenderIdentity,
  LookingFor,
  QueerPreference,
  SexualOrientation,
} from '../types';
import type { ProfileCreationScreenProps } from '../navigation/types';

export function ProfileCreationScreen({ navigation }: ProfileCreationScreenProps) {
  const { onboarding, updateProfile } = useApp();
  const profile = onboarding.profile;

  const [name, setName] = useState(profile.name ?? '');
  const [age, setAge] = useState(profile.age ? String(profile.age) : '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [heightInches, setHeightInches] = useState(profile.heightInches ?? 66);
  const [genderIdentity, setGenderIdentity] = useState<GenderIdentity>(
    profile.genderIdentity ?? 'prefer_not_to_say',
  );
  const [sexualOrientation, setSexualOrientation] = useState<SexualOrientation>(
    profile.sexualOrientation ?? 'prefer_not_to_say',
  );
  const [lookingFor, setLookingFor] = useState<LookingFor[]>(profile.lookingFor ?? []);
  const [queerPreferences, setQueerPreferences] = useState<QueerPreference[]>(
    profile.queerPreferences ?? [],
  );
  const [personalityTags, setPersonalityTags] = useState<string[]>(
    profile.personalityTags ?? [],
  );
  const [photos] = useState<string[]>(profile.photos ?? []);

  const toggleLookingFor = (value: LookingFor) => {
    setLookingFor((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const toggleQueerPref = (value: QueerPreference) => {
    setQueerPreferences((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const togglePersonalityTag = (tag: string) => {
    setPersonalityTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleContinue = () => {
    updateProfile({
      name,
      age: parseInt(age, 10) || 0,
      location,
      heightInches,
      photos,
      genderIdentity,
      sexualOrientation,
      lookingFor,
      queerPreferences,
      personalityTags,
    });
    navigation.navigate('Preferences');
  };

  const heightLabel = HEIGHT_OPTIONS.find((h) => h.value === heightInches)?.label ?? '';

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <ProgressBar currentStep={1} totalSteps={3} label="Profile" />

      <Text style={styles.title}>Tell us about you</Text>
      <Text style={styles.subtitle}>
        Build a profile that reflects who you are — no performative bios required.
      </Text>

      <Text style={styles.sectionLabel}>Photos</Text>
      <PhotoPickerPlaceholder photos={photos} onAddPhoto={() => {}} />

      <Input label="Name" placeholder="What should we call you?" value={name} onChangeText={setName} />
      <Input
        label="Age"
        placeholder="25"
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
      />
      <Input
        label="Location"
        placeholder="City, State"
        value={location}
        onChangeText={setLocation}
      />

      <Text style={styles.sectionLabel}>Height: {heightLabel}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.heightScroll}>
        {HEIGHT_OPTIONS.map((h) => (
          <Pressable
            key={h.value}
            style={[styles.heightChip, heightInches === h.value && styles.heightChipActive]}
            onPress={() => setHeightInches(h.value)}
          >
            <Text
              style={[
                styles.heightChipText,
                heightInches === h.value && styles.heightChipTextActive,
              ]}
            >
              {h.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>Gender identity</Text>
      <TagSelector
        options={GENDER_OPTIONS}
        selected={[genderIdentity]}
        onToggle={(v) => setGenderIdentity(v)}
        multiSelect={false}
      />

      <Text style={styles.sectionLabel}>Sexual orientation</Text>
      <TagSelector
        options={ORIENTATION_OPTIONS}
        selected={[sexualOrientation]}
        onToggle={(v) => setSexualOrientation(v)}
        multiSelect={false}
      />

      <Text style={styles.sectionLabel}>Looking for</Text>
      <TagSelector
        options={LOOKING_FOR_OPTIONS}
        selected={lookingFor}
        onToggle={toggleLookingFor}
      />

      <Text style={styles.sectionLabel}>Queer dating preferences</Text>
      <Text style={styles.hint}>Optional — helps us find compatible matches</Text>
      <TagSelector
        options={QUEER_PREFERENCE_OPTIONS}
        selected={queerPreferences}
        onToggle={toggleQueerPref}
      />

      <Text style={styles.sectionLabel}>Personality & vibe</Text>
      <View style={styles.personalityTags}>
        {PERSONALITY_TAGS.map((tag) => {
          const selected = personalityTags.includes(tag);
          return (
            <Pressable
              key={tag}
              style={[styles.personalityChip, selected && styles.personalityChipActive]}
              onPress={() => togglePersonalityTag(tag)}
            >
              <Text
                style={[
                  styles.personalityChipText,
                  selected && styles.personalityChipTextActive,
                ]}
              >
                {tag}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Button title="Continue to preferences" onPress={handleContinue} size="lg" style={styles.btn} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  heightScroll: {
    marginBottom: spacing.md,
  },
  heightChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  heightChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  heightChipText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  heightChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  personalityTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  personalityChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  personalityChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  personalityChipText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  personalityChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  btn: {
    marginTop: spacing.md,
  },
});
