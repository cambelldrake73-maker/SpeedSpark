import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, ScreenContainer } from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { MOCK_PARTNER } from '../data/mockUsers';
import { simulatePartnerFeedback, useApp } from '../context/AppContext';
import type { PostDateFeedbackScreenProps } from '../navigation/types';

export function PostDateFeedbackScreen({ navigation, route }: PostDateFeedbackScreenProps) {
  const { partnerId, dateId } = route.params;
  const { setLastFeedback, setPartnerFeedback } = useApp();

  const [feltSafe, setFeltSafe] = useState<boolean | null>(null);
  const [goodConversation, setGoodConversation] = useState<boolean | null>(null);
  const [wouldTalkAgain, setWouldTalkAgain] = useState<boolean | null>(null);
  const [vibeRating, setVibeRating] = useState(0);
  const [notes, setNotes] = useState('');

  const isComplete =
    feltSafe !== null &&
    goodConversation !== null &&
    wouldTalkAgain !== null &&
    vibeRating > 0;

  const handleSubmit = () => {
    if (!isComplete) return;

    const feedback = {
      dateId,
      partnerId,
      feltSafe: feltSafe!,
      goodConversation: goodConversation!,
      wouldTalkAgain: wouldTalkAgain!,
      vibeRating,
      notes: notes || undefined,
    };

    setLastFeedback(feedback);
    setPartnerFeedback(simulatePartnerFeedback(dateId, partnerId));

    navigation.replace('MatchResult', { partnerId, dateId });
  };

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <Text style={styles.title}>How did it go?</Text>
      <Text style={styles.subtitle}>
        Your feedback is private and helps us improve future matches with {MOCK_PARTNER.name}.
      </Text>

      <YesNoQuestion
        question="Did you feel safe during the date?"
        value={feltSafe}
        onChange={setFeltSafe}
      />

      <YesNoQuestion
        question="Was it a good conversation?"
        value={goodConversation}
        onChange={setGoodConversation}
      />

      <YesNoQuestion
        question="Would you like to talk to them again?"
        value={wouldTalkAgain}
        onChange={setWouldTalkAgain}
        highlight
      />

      <Text style={styles.sectionLabel}>Overall vibe</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => setVibeRating(star)}>
            <Ionicons
              name={star <= vibeRating ? 'star' : 'star-outline'}
              size={36}
              color={star <= vibeRating ? colors.warning : colors.border}
            />
          </Pressable>
        ))}
      </View>

      <Input
        label="Private notes (optional)"
        placeholder="Anything you'd like us to know for future matching..."
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        style={styles.notesInput}
      />

      <View style={styles.privacyNote}>
        <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
        <Text style={styles.privacyText}>
          {MOCK_PARTNER.name} won't see your answers. Match results are only revealed
          if you both want to connect again.
        </Text>
      </View>

      <Button
        title="Submit feedback"
        onPress={handleSubmit}
        size="lg"
        disabled={!isComplete}
        style={styles.submitBtn}
      />
    </ScreenContainer>
  );
}

function YesNoQuestion({
  question,
  value,
  onChange,
  highlight = false,
}: {
  question: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.question, highlight && styles.questionHighlight]}>
      <Text style={styles.questionText}>{question}</Text>
      <View style={styles.yesNoRow}>
        <Pressable
          style={[styles.yesNoBtn, value === true && styles.yesNoBtnYes]}
          onPress={() => onChange(true)}
        >
          <Text style={[styles.yesNoText, value === true && styles.yesNoTextActive]}>
            Yes
          </Text>
        </Pressable>
        <Pressable
          style={[styles.yesNoBtn, value === false && styles.yesNoBtnNo]}
          onPress={() => onChange(false)}
        >
          <Text style={[styles.yesNoText, value === false && styles.yesNoTextActive]}>
            No
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
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
  question: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionHighlight: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.surfaceAlt,
  },
  questionText: {
    ...typography.body,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  yesNoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  yesNoBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  yesNoBtnYes: {
    borderColor: colors.success,
    backgroundColor: colors.successLight,
  },
  yesNoBtnNo: {
    borderColor: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
  },
  yesNoText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  yesNoTextActive: {
    color: colors.text,
  },
  sectionLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
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
});
