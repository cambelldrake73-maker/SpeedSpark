import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from './ProgressBar';
import { colors, spacing, typography } from '../constants/theme';

interface OnboardingStepProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  dense?: boolean;
}

export function OnboardingStep({
  currentStep,
  totalSteps,
  title,
  subtitle,
  dense = false,
}: OnboardingStepProps) {
  return (
    <View style={[styles.container, dense && styles.denseContainer]}>
      <ProgressBar currentStep={currentStep} totalSteps={totalSteps} dense={dense} />
      <Text style={[styles.title, dense && styles.denseTitle]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  denseContainer: {
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  denseTitle: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
});
