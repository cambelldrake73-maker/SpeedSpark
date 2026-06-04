import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

export type QueueStatus = 'idle' | 'searching';

interface QueueStatusPanelProps {
  status: QueueStatus;
  searchSeconds: number;
  identityVerified: boolean;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
  onVerifyIdentity: () => void;
}

export function QueueStatusPanel({
  status,
  searchSeconds,
  identityVerified,
  onJoinQueue,
  onLeaveQueue,
  onVerifyIdentity,
}: QueueStatusPanelProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.steps}>
        <StepIndicator label="Join" active={status !== 'idle'} done={status !== 'idle'} />
        <StepLine done={status === 'searching'} />
        <StepIndicator label="Pair" active={status === 'searching'} done={false} />
        <StepLine done={false} />
        <StepIndicator label="Date" active={false} done={false} />
      </View>

      {status === 'idle' && !identityVerified && (
        <View style={styles.body}>
          <View style={styles.idleIcon}>
            <Ionicons name="shield-checkmark-outline" size={32} color={colors.sparkOrange} />
          </View>
          <Text style={styles.idleTitle}>Safety check first</Text>
          <Text style={styles.idleText}>
            A quick live selfie confirms you match your profile photos before you video chat
            with anyone. It keeps the window safer for everyone.
          </Text>
          <Button title="Complete safety check" onPress={onVerifyIdentity} size="lg" />
        </View>
      )}

      {status === 'idle' && identityVerified && (
        <View style={styles.body}>
          <View style={styles.verifiedChip}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.verifiedChipText}>Safety check complete</Text>
          </View>
          <View style={styles.idleIcon}>
            <Ionicons name="people-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.idleTitle}>Ready when you are</Text>
          <Text style={styles.idleText}>
            Join the queue and we'll automatically pair you into a 5-minute date — no profile
            preview first. You'll see who you dated after, then fill out the survey.
          </Text>
          <Button title="Join the queue" onPress={onJoinQueue} size="lg" />
        </View>
      )}

      {status === 'searching' && (
        <View style={styles.body}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.searchingTitle}>Finding your next date…</Text>
          <Text style={styles.searchingText}>
            When we find a compatible person, your 5-minute date starts automatically — you'll
            meet their profile afterward.
          </Text>
          <View style={styles.timerChip}>
            <Ionicons name="hourglass-outline" size={14} color={colors.primary} />
            <Text style={styles.timerText}>{searchSeconds}s in queue</Text>
          </View>
          <Button title="Leave queue" onPress={onLeaveQueue} variant="outline" size="sm" />
        </View>
      )}
    </View>
  );
}

function StepIndicator({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <View style={styles.step}>
      <View
        style={[
          styles.stepDot,
          active && styles.stepDotActive,
          done && styles.stepDotDone,
        ]}
      >
        {done ? (
          <Ionicons name="checkmark" size={12} color={colors.surface} />
        ) : (
          <View style={[styles.stepDotInner, active && styles.stepDotInnerActive]} />
        )}
      </View>
      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
    </View>
  );
}

function StepLine({ done }: { done: boolean }) {
  return <View style={[styles.stepLine, done && styles.stepLineDone]} />;
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  step: {
    alignItems: 'center',
    width: 56,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: colors.primaryLight,
  },
  stepDotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  stepDotInnerActive: {
    backgroundColor: colors.primary,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  stepLabelActive: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
    maxWidth: 40,
  },
  stepLineDone: {
    backgroundColor: colors.primaryLight,
  },
  body: {
    gap: spacing.md,
    alignItems: 'center',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successLight,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  verifiedChipText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.success,
  },
  idleIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  idleText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  searchingTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  searchingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  timerText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
  },
});
