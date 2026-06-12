import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  DistanceSlider,
  DraggablePriorityList,
  FormErrorBanner,
  HeightRangeSlider,
  AuthFlowLogo,
  OnboardingStep,
  ScreenContainer,
  SectionHeader,
  TagSelector,
} from '../components';
import {
  INTERESTED_IN_GENDER_OPTIONS,
  PRESENTATION_OPTIONS,
} from '../constants/options';
import {
  DEFAULT_MATCHING_PRIORITY_ORDER,
  normalizeMatchingPriorityOrder,
} from '../constants/matchingPriorities';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import {
  ONBOARDING_TOTAL_STEPS,
  onboardingStepForPrefsWizard,
} from '../constants/onboardingProgress';
import { formatAuthErrorForUser } from '../utils/authErrors';
import { normalizeHeightInches } from '../utils/heightFormat';
import { useApp } from '../context/AppContext';
import { isSupabaseConfigured } from '../services/supabaseEnv';
import type { GenderIdentity, MatchingPriorityCategory, PresentationTag } from '../types';
import type { PreferencesScreenProps } from '../navigation/types';

const USE_NATIVE_PREFS_STEPS = Platform.OS === 'ios' || Platform.OS === 'android';
const PREFS_WIZARD_STEPS = 3;
const PREFS_SCROLL_STEPS = new Set([0, 1, 2]);

const PREFS_STEP_TITLES = [
  'Who you want to meet',
  'Physical preferences',
  'Rank',
];

const PREFS_STEP_SUBTITLES = [
  'Genders, age range, and how far we search.',
  'Height range and presentation compatibility.',
  undefined,
];

export function PreferencesScreen({ navigation, route }: PreferencesScreenProps) {
  const fromSettings = route.params?.fromSettings === true;
  const nativePrefsFlow = USE_NATIVE_PREFS_STEPS && !fromSettings;
  const {
    onboarding,
    preferences,
    currentUser,
    updatePreferences,
    updateCurrentUser,
    savePreferencesToServer,
  } = useApp();
  const prefs = fromSettings ? preferences : onboarding.preferences;

  const [wizardStep, setWizardStep] = useState(0);
  const [stepAttempted, setStepAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ageRangeMin, setAgeRangeMin] = useState(prefs.ageRangeMin ?? 21);
  const [ageRangeMax, setAgeRangeMax] = useState(prefs.ageRangeMax ?? 40);
  const [heightMinInches, setHeightMinInches] = useState(() =>
    normalizeHeightInches(prefs.heightMinInches, 60),
  );
  const [heightMaxInches, setHeightMaxInches] = useState(() =>
    normalizeHeightInches(prefs.heightMaxInches, 84),
  );

  const [maxDistanceMiles, setMaxDistanceMiles] = useState(prefs.maxDistanceMiles ?? 25);
  const [preferredLookingFor, setPreferredLookingFor] = useState<GenderIdentity[]>(() => {
    const fromPrefs = prefs.preferredLookingFor ?? [];
    if (fromPrefs.length > 0) {
      return fromPrefs;
    }
    if (fromSettings) {
      return currentUser.interestedInGenders ?? [];
    }
    return onboarding.profile.interestedInGenders ?? [];
  });
  const [preferredPresentationTags, setPreferredPresentationTags] = useState<PresentationTag[]>(
    prefs.preferredPresentationTags ?? [],
  );
  const [matchingPriorityOrder, setMatchingPriorityOrder] = useState<MatchingPriorityCategory[]>(
    () =>
      normalizeMatchingPriorityOrder(
        prefs.matchingPriorityOrder ?? DEFAULT_MATCHING_PRIORITY_ORDER,
      ),
  );
  const [priorityDragging, setPriorityDragging] = useState(false);

  const toggle = <T extends string>(list: T[], value: T, setter: (v: T[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const bannerMessages = useMemo(() => {
    const messages: string[] = [];
    if (nativePrefsFlow && stepAttempted && wizardStep === 0 && preferredLookingFor.length === 0) {
      messages.push('Select at least one gender you are looking for');
    }
    if (saveError) {
      messages.push(saveError);
    }
    return messages;
  }, [nativePrefsFlow, stepAttempted, wizardStep, preferredLookingFor.length, saveError]);

  const savePreferences = async () => {
    setSaveError(null);

    if (preferredLookingFor.length === 0) {
      setSaveError('Select at least one gender you are looking for');
      return;
    }

    const prefsUpdate = {
      ageRangeMin,
      ageRangeMax,
      heightMinInches,
      heightMaxInches,
      maxDistanceMiles,
      preferredOrientations: [],
      preferredLookingFor,
      preferredQueerRoles: [],
      preferredPresentationTags,
      matchingPriorityOrder,
    };

    updatePreferences(prefsUpdate);
    updateCurrentUser({ interestedInGenders: preferredLookingFor });

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

  const handleContinue = () => {
    if (nativePrefsFlow) {
      setStepAttempted(true);
      setSaveError(null);

      if (wizardStep === 0 && preferredLookingFor.length === 0) {
        return;
      }

      if (wizardStep < PREFS_WIZARD_STEPS - 1) {
        setStepAttempted(false);
        setWizardStep((step) => step + 1);
        return;
      }

      void savePreferences();
      return;
    }

    void savePreferences();
  };

  const handleBack = () => {
    if (nativePrefsFlow && wizardStep > 0) {
      setStepAttempted(false);
      setSaveError(null);
      setWizardStep((step) => step - 1);
      return;
    }
    navigation.goBack();
  };

  const renderLookingFor = () => (
    <>
      <SectionHeader title="Looking for" hint="Select all genders you are open to meeting" />
      <TagSelector
        options={INTERESTED_IN_GENDER_OPTIONS}
        selected={preferredLookingFor}
        onToggle={(v) => toggle(preferredLookingFor, v, setPreferredLookingFor)}
        compact
      />
    </>
  );

  const renderAgeAndDistance = () => (
    <>
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
    </>
  );

  const renderHeight = () => (
    <>
      <SectionHeader title="Height preference" hint="Drag to set your preferred height range" />
      <HeightRangeSlider
        minInches={heightMinInches}
        maxInches={heightMaxInches}
        onChangeMin={setHeightMinInches}
        onChangeMax={setHeightMaxInches}
      />
    </>
  );

  const renderPresentation = () => (
    <>
      <SectionHeader
        title="Presentation compatibility"
        hint="Optional — who you tend to connect with visually"
      />
      <TagSelector
        options={PRESENTATION_OPTIONS}
        selected={preferredPresentationTags}
        onToggle={(v) => toggle(preferredPresentationTags, v, setPreferredPresentationTags)}
        compact
      />
    </>
  );

  const renderPriorities = (showHeader = true) => (
    <>
      {showHeader ? <SectionHeader title="Rank" /> : null}
      <DraggablePriorityList
        order={matchingPriorityOrder}
        onChange={setMatchingPriorityOrder}
        onDragStateChange={setPriorityDragging}
      />
    </>
  );

  const renderMeetPrefs = () => (
    <>
      {renderLookingFor()}
      {renderAgeAndDistance()}
    </>
  );

  const renderPhysicalPrefs = () => (
    <>
      {renderHeight()}
      {renderPresentation()}
    </>
  );

  const renderNativeStep = () => {
    switch (wizardStep) {
      case 0:
        return renderMeetPrefs();
      case 1:
        return renderPhysicalPrefs();
      case 2:
      default:
        return renderPriorities(false);
    }
  };

  const renderScrollForm = () => (
    <>
      {renderMeetPrefs()}
      {renderPhysicalPrefs()}
      {renderPriorities()}
    </>
  );

  const nativeScroll = nativePrefsFlow && PREFS_SCROLL_STEPS.has(wizardStep);
  const continueLabel = nativePrefsFlow
    ? wizardStep < PREFS_WIZARD_STEPS - 1
      ? 'Continue'
      : 'Continue to verification'
    : fromSettings
      ? 'Save preferences'
      : 'Continue to verification';

  return (
    <ScreenContainer
      scroll={!nativePrefsFlow || nativeScroll}
      scrollEnabled={!priorityDragging}
      scrollToTopKey={nativePrefsFlow ? wizardStep : undefined}
      scrollToTopOnFocus={!fromSettings}
      contentStyle={nativePrefsFlow ? { ...styles.content, ...styles.contentStepped } : styles.content}
    >
      {fromSettings ? (
        <View style={styles.settingsHeader}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.settingsHeaderTitle}>Match preferences</Text>
          <View style={styles.backBtn} />
        </View>
      ) : (
        <>
          {(!nativePrefsFlow || wizardStep === 0) && <AuthFlowLogo />}
          <OnboardingStep
            currentStep={
              nativePrefsFlow
                ? onboardingStepForPrefsWizard(wizardStep)
                : onboardingStepForPrefsWizard(0)
            }
            totalSteps={ONBOARDING_TOTAL_STEPS}
            title={
              nativePrefsFlow
                ? PREFS_STEP_TITLES[wizardStep] ?? 'Your match preferences'
                : 'Your match preferences'
            }
            subtitle={
              nativePrefsFlow
                ? PREFS_STEP_SUBTITLES[wizardStep]
                : "Tell us who you'd love to meet. Leave sections blank to stay open-minded — we'll still prioritize safety and shared intentions."
            }
          />
        </>
      )}

      <View style={nativePrefsFlow ? styles.stepBody : undefined}>
        {nativePrefsFlow ? renderNativeStep() : renderScrollForm()}
      </View>

      <View style={nativePrefsFlow ? styles.stepFooter : undefined}>
        <FormErrorBanner messages={bannerMessages} />
        <Button
          title={continueLabel}
          onPress={handleContinue}
          size="lg"
          style={styles.btn}
          loading={isSaving}
          disabled={isSaving}
        />
        {!fromSettings && <Button title="Back" onPress={handleBack} variant="ghost" />}
      </View>
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
  contentStepped: {
    flexGrow: 1,
  },
  stepBody: {
    flex: 1,
    minHeight: 0,
  },
  stepFooter: {
    marginTop: 'auto',
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
