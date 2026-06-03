import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, ProgressBar, ScreenContainer } from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { useApp } from '../context/AppContext';
import type { VerificationScreenProps } from '../navigation/types';

export function VerificationScreen({ navigation }: VerificationScreenProps) {
  const { completeOnboarding } = useApp();

  const handleContinue = () => {
    completeOnboarding();
    navigation.replace('SpeedDateLobby');
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <ProgressBar currentStep={3} totalSteps={3} label="Verification" />

      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
        </View>
      </View>

      <Text style={styles.title}>Verify your identity</Text>
      <Text style={styles.subtitle}>
        A verified community keeps everyone safer. Real identity verification
        will be added in a future update.
      </Text>

      <View style={styles.placeholder}>
        <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
        <Text style={styles.placeholderTitle}>Verification coming soon</Text>
        <Text style={styles.placeholderText}>
          You'll take a quick selfie matched to your profile photos. For this MVP,
          you can continue with a placeholder verified status.
        </Text>
      </View>

      <View style={styles.steps}>
        <StepItem number={1} text="Take a live selfie" />
        <StepItem number={2} text="We match it to your profile photos" />
        <StepItem number={3} text="Get a verified badge on your profile" />
      </View>

      <View style={styles.actions}>
        <Button
          title="Skip for now (MVP)"
          onPress={handleContinue}
          size="lg"
        />
        <Button
          title="Start verification (placeholder)"
          onPress={handleContinue}
          variant="outline"
          disabled
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
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
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
    marginBottom: spacing.xl,
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
    color: colors.surface,
    fontWeight: '700',
    fontSize: 14,
  },
  stepText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
});
