import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ProgressBar, ScreenContainer, TagSelector } from '../components';
import {
  DISTANCE_OPTIONS,
  LOOKING_FOR_OPTIONS,
  ORIENTATION_OPTIONS,
  QUEER_PREFERENCE_OPTIONS,
} from '../constants/options';
import { colors, spacing, typography } from '../constants/theme';
import { useApp } from '../context/AppContext';
import type { LookingFor, QueerPreference, SexualOrientation } from '../types';
import type { PreferencesScreenProps } from '../navigation/types';

export function PreferencesScreen({ navigation }: PreferencesScreenProps) {
  const { onboarding, updatePreferences } = useApp();
  const prefs = onboarding.preferences;

  const [ageRangeMin, setAgeRangeMin] = useState(prefs.ageRangeMin ?? 21);
  const [ageRangeMax, setAgeRangeMax] = useState(prefs.ageRangeMax ?? 40);
  const [maxDistanceMiles, setMaxDistanceMiles] = useState(prefs.maxDistanceMiles ?? 25);
  const [preferredOrientations, setPreferredOrientations] = useState<SexualOrientation[]>(
    prefs.preferredOrientations ?? [],
  );
  const [preferredLookingFor, setPreferredLookingFor] = useState<LookingFor[]>(
    prefs.preferredLookingFor ?? [],
  );
  const [preferredQueerPreferences, setPreferredQueerPreferences] = useState<QueerPreference[]>(
    prefs.preferredQueerPreferences ?? [],
  );

  const toggleOrientation = (value: SexualOrientation) => {
    setPreferredOrientations((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const toggleLookingFor = (value: LookingFor) => {
    setPreferredLookingFor((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const toggleQueerPref = (value: QueerPreference) => {
    setPreferredQueerPreferences((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const handleContinue = () => {
    updatePreferences({
      ageRangeMin,
      ageRangeMax,
      maxDistanceMiles,
      preferredOrientations,
      preferredLookingFor,
      preferredQueerPreferences,
    });
    navigation.navigate('Verification');
  };

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <ProgressBar currentStep={2} totalSteps={3} label="Preferences" />

      <Text style={styles.title}>Who are you hoping to meet?</Text>
      <Text style={styles.subtitle}>
        Set your matching preferences. We'll use these to pair you during speed date windows.
      </Text>

      <Text style={styles.sectionLabel}>Age range</Text>
      <View style={styles.rangeRow}>
        <RangeControl
          label="Min"
          value={ageRangeMin}
          onDecrement={() => setAgeRangeMin((v) => Math.max(18, v - 1))}
          onIncrement={() => setAgeRangeMin((v) => Math.min(ageRangeMax - 1, v + 1))}
        />
        <Text style={styles.rangeDash}>—</Text>
        <RangeControl
          label="Max"
          value={ageRangeMax}
          onDecrement={() => setAgeRangeMax((v) => Math.max(ageRangeMin + 1, v - 1))}
          onIncrement={() => setAgeRangeMax((v) => Math.min(99, v + 1))}
        />
      </View>

      <Text style={styles.sectionLabel}>Maximum distance</Text>
      <View style={styles.chipRow}>
        {DISTANCE_OPTIONS.map((d) => (
          <Pressable
            key={d.value}
            style={[styles.chip, maxDistanceMiles === d.value && styles.chipActive]}
            onPress={() => setMaxDistanceMiles(d.value)}
          >
            <Text style={[styles.chipText, maxDistanceMiles === d.value && styles.chipTextActive]}>
              {d.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Open to these orientations</Text>
      <Text style={styles.hint}>Leave empty to stay open to all</Text>
      <TagSelector
        options={ORIENTATION_OPTIONS}
        selected={preferredOrientations}
        onToggle={toggleOrientation}
      />

      <Text style={styles.sectionLabel}>Their dating intentions</Text>
      <TagSelector
        options={LOOKING_FOR_OPTIONS}
        selected={preferredLookingFor}
        onToggle={toggleLookingFor}
      />

      <Text style={styles.sectionLabel}>Preference compatibility</Text>
      <Text style={styles.hint}>Optional queer-specific matching signals</Text>
      <TagSelector
        options={QUEER_PREFERENCE_OPTIONS}
        selected={preferredQueerPreferences}
        onToggle={toggleQueerPref}
      />

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Private matching balance</Text>
        <Text style={styles.infoText}>
          We may use internal compatibility signals — including a private attractiveness
          balance — to improve pairings over time. This is never shown on your profile
          or shared with other users.
        </Text>
      </View>

      <Button title="Continue to verification" onPress={handleContinue} size="lg" style={styles.btn} />
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
    color: colors.text,
    minWidth: 40,
    textAlign: 'center',
  },
  rangeDash: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  chipTextActive: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
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
    marginBottom: spacing.md,
  },
});
