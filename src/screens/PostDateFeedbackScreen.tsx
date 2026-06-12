import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, DatingProfileCard, ScaleRating, ScreenContainer } from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { MOCK_PARTNER } from '../data/mockUsers';
import { useAuth } from '../context/AuthContext';
import { simulatePartnerFeedback, useApp } from '../context/AppContext';
import { submitDateFeedback } from '../services';
import { formatAuthErrorForUser } from '../utils/authErrors';
import { isBackendSpeedDateId } from '../utils/speedDateIds';
import type { PostDateFeedbackScreenProps } from '../navigation/types';

export function PostDateFeedbackScreen({ navigation, route }: PostDateFeedbackScreenProps) {
  const { partnerId, dateId } = route.params;
  const { session } = useAuth();
  const { currentUser, setLastFeedback, setPartnerFeedback, currentDatePartner, registerDemoMatch } =
    useApp();
  const partner = currentDatePartner ?? MOCK_PARTNER;
  const userId = session?.user?.id ?? currentUser.id;
  const useBackend = isBackendSpeedDateId(dateId) && Boolean(userId);

  const [attractivenessRating, setAttractivenessRating] = useState(0);
  const [wantToMatch, setWantToMatch] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = attractivenessRating > 0 && wantToMatch !== null;

  const finishFeedback = () => {
    navigation.replace('DateQueue');
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setSubmitError(null);

    if (useBackend) {
      setIsSubmitting(true);
      try {
        const { feedback, matchResult } = await submitDateFeedback(
          userId,
          dateId,
          partnerId,
          attractivenessRating,
          wantToMatch === true,
        );

        setLastFeedback(feedback);
        if (
          matchResult.partnerFeedbackSubmitted &&
          matchResult.partnerWouldTalkAgain !== null
        ) {
          setPartnerFeedback({
            dateId,
            partnerId,
            attractivenessRating: 0,
            wouldTalkAgain: matchResult.partnerWouldTalkAgain,
          });
        } else {
          setPartnerFeedback(null);
        }

        finishFeedback();
      } catch (error) {
        setSubmitError(formatAuthErrorForUser(error));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const feedback = {
      dateId,
      partnerId,
      attractivenessRating,
      wouldTalkAgain: wantToMatch === true,
    };

    const partnerFeedbackResult = simulatePartnerFeedback(dateId, partnerId);

    setLastFeedback(feedback);
    setPartnerFeedback(partnerFeedbackResult);

    if (wantToMatch === true && partnerFeedbackResult.wouldTalkAgain) {
      registerDemoMatch(partner);
    }

    finishFeedback();
  };

  return (
    <ScreenContainer scroll={true} contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Do you want to match with your date?</Text>
      </View>

      <DatingProfileCard user={partner} variant="compact" />

      <View style={styles.feedbackPanel}>
        <View style={styles.feedbackSection}>
          <Text style={styles.stepLabel}>Attraction</Text>
          <ScaleRating
            label="How attracted to this person were you?"
            hint="1 = not attracted · 10 = very attracted"
            value={attractivenessRating}
            onChange={setAttractivenessRating}
            min={1}
            max={10}
            compact
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.feedbackSection}>
          <View style={styles.matchChoices}>
            <Pressable
              onPress={() => setWantToMatch(true)}
              style={({ pressed }) => [
                styles.matchChoice,
                wantToMatch === true && styles.matchChoiceSelected,
                pressed && styles.matchChoicePressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: wantToMatch === true }}
            >
              <Ionicons
                name="heart"
                size={20}
                color={wantToMatch === true ? colors.sparkOrange : colors.textMuted}
              />
              <Text
                style={[
                  styles.matchChoiceText,
                  wantToMatch === true && styles.matchChoiceTextSelected,
                ]}
              >
                Match
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setWantToMatch(false)}
              style={({ pressed }) => [
                styles.matchChoice,
                wantToMatch === false && styles.matchChoiceSelected,
                pressed && styles.matchChoicePressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: wantToMatch === false }}
            >
              <Ionicons
                name="close"
                size={20}
                color={wantToMatch === false ? colors.sparkOrange : colors.textMuted}
              />
              <Text
                style={[
                  styles.matchChoiceText,
                  wantToMatch === false && styles.matchChoiceTextSelected,
                ]}
              >
                No match
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
          <Text style={styles.privacyText}>
            Ratings never appear on profiles or get shared with your date.
          </Text>
        </View>

        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

        <Button
          title="Submit"
          onPress={() => void handleSubmit()}
          size="lg"
          disabled={!canSubmit || isSubmitting}
          loading={isSubmitting}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    fontSize: 26,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  feedbackPanel: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  feedbackSection: {
    gap: spacing.xs,
  },
  stepLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.sparkOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  matchChoices: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  matchChoice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  matchChoiceSelected: {
    borderColor: colors.sparkOrange,
    backgroundColor: colors.accentLight,
  },
  matchChoicePressed: {
    opacity: 0.9,
  },
  matchChoiceText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  matchChoiceTextSelected: {
    color: colors.text,
  },
  footer: {
    gap: spacing.sm,
  },
  privacyNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  privacyText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  submitError: {
    ...typography.caption,
    color: colors.error,
    lineHeight: 18,
  },
});
