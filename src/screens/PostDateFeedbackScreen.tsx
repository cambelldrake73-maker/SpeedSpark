import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, DatingProfileCard, ScaleRating, ScreenContainer, SelectableOption } from '../components';
import { COPY } from '../constants/options';
import { colors, spacing, typography } from '../constants/theme';
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
  const { currentUser, setLastFeedback, setPartnerFeedback, currentDatePartner } = useApp();
  const partner = currentDatePartner ?? MOCK_PARTNER;
  const partnerName = partner.name;
  const userId = session?.user?.id ?? currentUser.id;
  const useBackend = isBackendSpeedDateId(dateId) && Boolean(userId);

  const [attractivenessRating, setAttractivenessRating] = useState(0);
  const [wantToMatch, setWantToMatch] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = attractivenessRating > 0 && wantToMatch !== null;

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

        navigation.replace('MatchResult', { partnerId, dateId });
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

    setLastFeedback(feedback);
    setPartnerFeedback(simulatePartnerFeedback(dateId, partnerId));
    navigation.replace('MatchResult', { partnerId, dateId });
  };

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <Text style={styles.title}>How was your date?</Text>
      <Text style={styles.subtitle}>
        Here's who you just talked to. Your rating and match choice stay private — {partnerName}{' '}
        won't see them.
      </Text>

      <View style={styles.profileReveal}>
        <DatingProfileCard user={partner} />
      </View>

      <View style={styles.ratingCard}>
        <ScaleRating
          label="How would you rate this person on attractiveness?"
          hint="1 = not attracted · 10 = very attracted"
          value={attractivenessRating}
          onChange={setAttractivenessRating}
          min={1}
          max={10}
        />
      </View>

      <View style={styles.matchCard}>
        <Text style={styles.matchTitle}>Would you like to match with {partnerName}?</Text>
        <Text style={styles.matchHint}>
          A match only happens if you both say yes. This is separate from your attractiveness
          rating.
        </Text>
        <SelectableOption
          selected={wantToMatch === true}
          onPress={() => setWantToMatch(true)}
          icon="heart"
          title="Yes — I'd like to match"
          description="You're open to messaging and seeing where it goes."
        />
        <SelectableOption
          selected={wantToMatch === false}
          onPress={() => setWantToMatch(false)}
          icon="close-circle-outline"
          title="No thanks"
          description="Not interested in matching right now — totally fine."
        />
      </View>

      <View style={styles.privacyNote}>
        <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
        <Text style={styles.privacyText}>{COPY.sparkPrivate}</Text>
      </View>

      {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

      <Button
        title="Submit"
        onPress={() => void handleSubmit()}
        size="lg"
        disabled={!canSubmit || isSubmitting}
        loading={isSubmitting}
        style={styles.submitBtn}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
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
    lineHeight: 24,
  },
  profileReveal: {
    marginBottom: spacing.lg,
  },
  ratingCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  matchCard: {
    marginBottom: spacing.lg,
  },
  matchTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  matchHint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  privacyNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  privacyText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  submitBtn: {
    marginBottom: spacing.xl,
  },
  submitError: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
});
