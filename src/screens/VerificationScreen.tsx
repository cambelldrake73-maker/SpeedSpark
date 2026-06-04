import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, FormErrorBanner, OnboardingStep, ScreenContainer } from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { formatAuthErrorForUser } from '../utils/authErrors';
import type { VerificationScreenProps } from '../navigation/types';

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

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <OnboardingStep
        flowLabel={isWindowCheck ? 'Before you join' : 'Step 3 of 3'}
        currentStep={isWindowCheck ? 1 : 3}
        totalSteps={isWindowCheck ? 1 : 3}
        title={isWindowCheck ? 'Safety check' : 'Verify your identity'}
        subtitle={
          isWindowCheck
            ? 'Before each live window, we confirm you match your profile photos. It is mainly about safety — so everyone on a video date is who they say they are.'
            : 'Verified profiles help keep the community safe. Real verification ships soon — for now, you can explore the full demo flow.'
        }
      />

      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
        </View>
      </View>

      <View style={styles.placeholder}>
        <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
        <Text style={styles.placeholderTitle}>
          {isWindowCheck ? 'Live selfie safety check' : 'Verification coming soon'}
        </Text>
        <Text style={styles.placeholderText}>
          {isWindowCheck
            ? 'Take a quick live selfie matched to your profile photos. Until the real check ships, continue with a demo pass for this window.'
            : "You'll take a quick live selfie matched to your profile photos. Until then, continue with a placeholder verified badge for demo purposes."}
        </Text>
      </View>

      <View style={styles.steps}>
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

      <View style={styles.trustBox}>
        <Text style={styles.trustText}>
          {isWindowCheck
            ? 'Your selfie is only used for safety — to confirm you are the person in your photos before a live video date.'
            : "SpeedSpark never sells your verification data. It's only used to keep the community safe."}
        </Text>
      </View>

      <FormErrorBanner messages={saveError ? [saveError] : []} />
      <Button
        title={isWindowCheck ? 'Complete check & return to lobby' : 'Enter the lobby (demo)'}
        onPress={handleContinue}
        size="lg"
        loading={isSaving}
        disabled={isSaving}
      />
      {!isWindowCheck && (
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
    marginBottom: spacing.lg,
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
