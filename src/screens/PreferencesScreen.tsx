import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  ChipGrid,
  DistanceSlider,
  FormErrorBanner,
  HeightFields,
  OnboardingStep,
  ScreenContainer,
  SectionHeader,
  TagSelector,
} from '../components';
import {
  COPY,
  DEALBREAKER_OPTIONS,
  LOOKING_FOR_OPTIONS,
  NICE_TO_HAVE_OPTIONS,
  ORIENTATION_OPTIONS,
  PRESENTATION_OPTIONS,
} from '../constants/options';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { isSupabaseConfigured } from '../services/supabaseEnv';
import { formatAuthErrorForUser } from '../utils/authErrors';
import type { LookingFor, PresentationTag, SexualOrientation } from '../types';
import type { PreferencesScreenProps } from '../navigation/types';
import {
  formatHeightInches,
  inchesToFeetInches,
  parseFeetInchesFields,
  validateFeetInchesFields,
} from '../utils/heightFormat';

export function PreferencesScreen({ navigation, route }: PreferencesScreenProps) {
  const fromSettings = route.params?.fromSettings === true;
  const { onboarding, preferences, updatePreferences, savePreferencesToServer } = useApp();
  const prefs = fromSettings ? preferences : onboarding.preferences;

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [ageRangeMin, setAgeRangeMin] = useState(prefs.ageRangeMin ?? 21);
  const [ageRangeMax, setAgeRangeMax] = useState(prefs.ageRangeMax ?? 40);

  const initialMin = inchesToFeetInches(prefs.heightMinInches ?? 60);
  const initialMax = inchesToFeetInches(prefs.heightMaxInches ?? 84);
  const [minFeet, setMinFeet] = useState(initialMin.feet);
  const [minInches, setMinInches] = useState(initialMin.inches);
  const [maxFeet, setMaxFeet] = useState(initialMax.feet);
  const [maxInches, setMaxInches] = useState(initialMax.inches);

  const [maxDistanceMiles, setMaxDistanceMiles] = useState(prefs.maxDistanceMiles ?? 25);
  const [preferredOrientations, setPreferredOrientations] = useState<SexualOrientation[]>(
    prefs.preferredOrientations ?? [],
  );
  const [preferredLookingFor, setPreferredLookingFor] = useState<LookingFor[]>(
    prefs.preferredLookingFor ?? [],
  );
  const [preferredPresentationTags, setPreferredPresentationTags] = useState<PresentationTag[]>(
    prefs.preferredPresentationTags ?? [],
  );
  const [dealbreakers, setDealbreakers] = useState<string[]>(prefs.dealbreakers ?? []);
  const [niceToHaves, setNiceToHaves] = useState<string[]>(prefs.niceToHaves ?? []);

  const toggle = <T extends string>(list: T[], value: T, setter: (v: T[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const minHeightError = validateFeetInchesFields(minFeet, minInches);
  const maxHeightError = validateFeetInchesFields(maxFeet, maxInches);
  const parsedMin = parseFeetInchesFields(minFeet, minInches);
  const parsedMax = parseFeetInchesFields(maxFeet, maxInches);
  const rangeOrderError =
    parsedMin != null && parsedMax != null && parsedMin > parsedMax
      ? 'Minimum height cannot be taller than maximum'
      : null;

  const bannerMessages = useMemo(() => {
    const messages: string[] = [];
    if (saveError) {
      messages.push(saveError);
    }
    if (!submitAttempted) {
      return messages;
    }
    if (minHeightError) messages.push(`Min height: ${minHeightError}`);
    if (maxHeightError) messages.push(`Max height: ${maxHeightError}`);
    if (rangeOrderError) messages.push(rangeOrderError);
    return messages;
  }, [submitAttempted, minHeightError, maxHeightError, rangeOrderError, saveError]);

  const showHeightErrors = submitAttempted;

  const handleContinue = async () => {
    setSubmitAttempted(true);
    setSaveError(null);

    if (minHeightError || maxHeightError || rangeOrderError) return;

    const prefsUpdate = {
      ageRangeMin,
      ageRangeMax,
      heightMinInches: parsedMin!,
      heightMaxInches: parsedMax!,
      maxDistanceMiles,
      preferredOrientations,
      preferredLookingFor,
      preferredQueerRoles: [],
      preferredPresentationTags,
      dealbreakers,
      niceToHaves,
    };

    updatePreferences(prefsUpdate);

    if (isSupabaseConfigured) {
      setIsSaving(true);
      try {
        await savePreferencesToServer(prefsUpdate);
      } catch (error) {
        setSaveError(formatAuthErrorForUser(error));
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    if (fromSettings) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Verification', { context: 'onboarding' });
  };

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      {fromSettings ? (
        <View style={styles.settingsHeader}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.settingsHeaderTitle}>Match preferences</Text>
          <View style={styles.backBtn} />
        </View>
      ) : (
        <OnboardingStep
          flowLabel="Step 2 of 3"
          currentStep={2}
          totalSteps={3}
          title="Your match preferences"
          subtitle="Tell us who you'd love to meet. Leave sections blank to stay open-minded — we'll still prioritize safety and shared intentions."
        />
      )}

      <SectionHeader title="Age range" />
      <View style={styles.rangeRow}>
        <RangeControl
          label="Min"
          value={ageRangeMin}
          onDecrement={() => setAgeRangeMin((v) => Math.max(18, v - 1))}
          onIncrement={() => setAgeRangeMin((v) => Math.min(ageRangeMax - 1, v + 1))}
        />
        <Text style={styles.rangeDash}>to</Text>
        <RangeControl
          label="Max"
          value={ageRangeMax}
          onDecrement={() => setAgeRangeMax((v) => Math.max(ageRangeMin + 1, v - 1))}
          onIncrement={() => setAgeRangeMax((v) => Math.min(99, v + 1))}
        />
      </View>

      <SectionHeader title="Maximum distance" hint="Drag to set how far you'll match" />
      <DistanceSlider value={maxDistanceMiles} onChange={setMaxDistanceMiles} />

      <SectionHeader
        title="Height preference"
        hint={showHeightErrors ? undefined : 'Optional range for match fit'}
        error={
          showHeightErrors && rangeOrderError && !minHeightError && !maxHeightError
            ? rangeOrderError
            : undefined
        }
      />
      <View style={styles.heightRow}>
        <View style={styles.heightField}>
          <HeightFields
            label="Min"
            feet={minFeet}
            inches={minInches}
            onFeetChange={setMinFeet}
            onInchesChange={setMinInches}
            error={showHeightErrors ? minHeightError ?? undefined : undefined}
          />
        </View>
        <View style={styles.heightField}>
          <HeightFields
            label="Max"
            feet={maxFeet}
            inches={maxInches}
            onFeetChange={setMaxFeet}
            onInchesChange={setMaxInches}
            error={showHeightErrors ? maxHeightError ?? undefined : undefined}
          />
        </View>
      </View>
      {!showHeightErrors && !minHeightError && !maxHeightError && parsedMin !== null && parsedMax !== null && (
        <Text style={styles.heightPrefLabel}>
          {formatHeightInches(parsedMin)} – {formatHeightInches(parsedMax)}
        </Text>
      )}

      <SectionHeader
        title="Dating intention compatibility"
        hint="Whose goals align with yours?"
      />
      <TagSelector
        options={LOOKING_FOR_OPTIONS}
        selected={preferredLookingFor}
        onToggle={(v) => toggle(preferredLookingFor, v, setPreferredLookingFor)}
      />

      <SectionHeader title="Orientation" hint="Leave empty to stay open to all" />
      <TagSelector
        options={ORIENTATION_OPTIONS}
        selected={preferredOrientations}
        onToggle={(v) => toggle(preferredOrientations, v, setPreferredOrientations)}
      />

      <SectionHeader title="Presentation compatibility" hint="Optional" />
      <TagSelector
        options={PRESENTATION_OPTIONS}
        selected={preferredPresentationTags}
        onToggle={(v) => toggle(preferredPresentationTags, v, setPreferredPresentationTags)}
      />

      <SectionHeader
        title="Dealbreakers"
        hint="Only traits someone can list on their profile — add yours under Lifestyle & values"
      />
      <ChipGrid
        options={DEALBREAKER_OPTIONS}
        selected={dealbreakers}
        onToggle={(v) => toggle(dealbreakers, v, setDealbreakers)}
      />

      <SectionHeader
        title="Nice-to-haves"
        hint="Profile tags or verified status — same options people choose about themselves"
      />
      <ChipGrid
        options={NICE_TO_HAVE_OPTIONS}
        selected={niceToHaves}
        onToggle={(v) => toggle(niceToHaves, v, setNiceToHaves)}
      />

      <View style={styles.infoBox}>
        <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Thoughtful matching</Text>
          <Text style={styles.infoText}>{COPY.matchFitPrivate}</Text>
        </View>
      </View>

      <FormErrorBanner messages={bannerMessages} />
      <Button
        title={fromSettings ? 'Save preferences' : 'Continue to verification'}
        onPress={handleContinue}
        size="lg"
        style={styles.btn}
        loading={isSaving}
        disabled={isSaving}
      />
      {!fromSettings && (
        <Button title="Back" onPress={() => navigation.goBack()} variant="ghost" />
      )}
    </ScreenContainer>
  );
}

function RangeControl({
  label,
  value,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={styles.rangeControl}>
      <Text style={styles.rangeLabel}>{label}</Text>
      <View style={styles.rangeButtons}>
        <Pressable style={styles.rangeBtn} onPress={onDecrement}>
          <Text style={styles.rangeBtnText}>−</Text>
        </Pressable>
        <Text style={styles.rangeValue}>{value}</Text>
        <Pressable style={styles.rangeBtn} onPress={onIncrement}>
          <Text style={styles.rangeBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  rangeControl: {
    alignItems: 'center',
  },
  rangeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  rangeButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rangeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeBtnText: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '600',
  },
  rangeValue: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
    minWidth: 40,
    textAlign: 'center',
  },
  rangeDash: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  heightPrefLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primaryDark,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  heightRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  heightField: {
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  btn: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsHeaderTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '700',
  },
});
