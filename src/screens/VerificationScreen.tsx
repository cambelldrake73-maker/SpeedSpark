import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, FormErrorBanner, OnboardingStep, ScreenContainer } from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import {
  ONBOARDING_TOTAL_STEPS,
  ONBOARDING_VERIFY_STEP,
} from '../constants/onboardingProgress';
import { useApp } from '../context/AppContext';
import { formatAuthErrorForUser } from '../utils/authErrors';
import type { VerificationScreenProps } from '../navigation/types';

const USE_STATIC_VERIFY_LAYOUT = Platform.OS === 'ios' || Platform.OS === 'android';

export function VerificationScreen({ navigation, route }: VerificationScreenProps) {
  const { completeOnboarding, verifyForWindow } = useApp();
  const isWindowCheck = route.params?.context === 'window';
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (isWindowCheck) {
      verifyForWindow();
      navigation.goBack();
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      await completeOnboarding();
      navigation.replace('SpeedDateLobby');
    } catch (error) {
      setSaveError(formatAuthErrorForUser(error));
    } finally {
      setIsSaving(false);
    }
  };

  const compact = USE_STATIC_VERIFY_LAYOUT;

  return (
    <ScreenContainer
      scroll={!USE_STATIC_VERIFY_LAYOUT}
      scrollToTopOnFocus={!isWindowCheck && !USE_STATIC_VERIFY_LAYOUT}
      contentStyle={USE_STATIC_VERIFY_LAYOUT ? styles.contentStatic : styles.content}
    >
      {isWindowCheck ? (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Safety check</Text>
        </View>
      ) : (
        <OnboardingStep
          currentStep={ONBOARDING_VERIFY_STEP}
          totalSteps={ONBOARDING_TOTAL_STEPS}
          title="Verify your identity"
          dense={compact}
        />
      )}

      <View style={USE_STATIC_VERIFY_LAYOUT ? styles.main : undefined}>
        <View style={[styles.iconContainer, compact && styles.iconContainerCompact]}>
          <View style={[styles.iconCircle, compact && styles.iconCircleCompact]}>
            <Ionicons
              name="shield-checkmark"
              size={compact ? 40 : 48}
              color={colors.primary}
            />
          </View>
        </View>

        <View style={[styles.placeholder, compact && styles.placeholderCompact]}>
          <Ionicons name="camera-outline" size={compact ? 28 : 32} color={colors.textMuted} />
          <Text style={styles.placeholderTitle}>
            {isWindowCheck ? 'Live selfie safety check' : 'Verification coming soon'}
          </Text>
          <Text style={styles.placeholderText}>
            {isWindowCheck
              ? 'Take a quick live selfie matched to your profile photos.'
              : "You'll take a quick live selfie matched to your profile photos. Until then, continue with a placeholder verified badge for demo purposes."}
          </Text>
        </View>

        <View style={[styles.steps, compact && styles.stepsCompact]}>
          <StepItem number={1} text="Take a live selfie in good lighting" />
          <StepItem number={2} text="We confirm it matches your profile photos" />
          <StepItem
            number={3}
            text={
              isWindowCheck
                ? 'Join the queue — you are cleared for this window'
                : 'Earn a verified badge others can trust for safety'
            }
          />
        </View>

        {!isWindowCheck && !USE_STATIC_VERIFY_LAYOUT ? (
          <View style={styles.trustBox}>
            <Text style={styles.trustText}>
              SpeedSpark never sells your verification data. It's only used to keep the community
              safe.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={USE_STATIC_VERIFY_LAYOUT ? styles.footer : undefined}>
        <FormErrorBanner messages={saveError ? [saveError] : []} />
        <Button
          title={isWindowCheck ? 'Complete check & return to lobby' : 'Enter the lobby (demo)'}
          onPress={handleContinue}
          size="lg"
          loading={isSaving}
          disabled={isSaving}
        />
        {!isWindowCheck && !USE_STATIC_VERIFY_LAYOUT && (
          <Button
            title="Start verification (placeholder)"
            onPress={handleContinue}
            variant="outline"
            disabled
            style={styles.secondaryBtn}
          />
        )}
        <Button
          title="Back"
          onPress={() => navigation.goBack()}
          variant="ghost"
          disabled={isSaving}
        />
      </View>
    </ScreenContainer>
  );
}

function StepItem({ number, text }: { number: number; text: string }) {
  return (
    <View style={styles.stepItem}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  contentStatic: {
    flex: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  main: {
    flex: 1,
    minHeight: 0,
  },
  footer: {
    marginTop: 'auto',
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  iconContainerCompact: {
    marginVertical: spacing.sm,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleCompact: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  placeholder: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  placeholderCompact: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  placeholderTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  placeholderText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  steps: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stepsCompact: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  stepText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  trustBox: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  trustText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },
  secondaryBtn: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
});
