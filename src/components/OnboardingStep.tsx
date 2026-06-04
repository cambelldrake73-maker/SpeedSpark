import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from './ProgressBar';
import { colors, spacing, typography } from '../constants/theme';

interface OnboardingStepProps {
  flowLabel: string;
  currentStep: number;
  totalSteps: number;
  title: string;
  subtitle: string;
}

export function OnboardingStep({
  flowLabel,
  currentStep,
  totalSteps,
  title,
  subtitle,
}: OnboardingStepProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.flow}>{flowLabel}</Text>
      <ProgressBar currentStep={currentStep} totalSteps={totalSteps} label="Onboarding" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  flow: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
});
