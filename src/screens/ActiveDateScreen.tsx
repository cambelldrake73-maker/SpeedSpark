import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, MatchCard, ScreenContainer } from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { DATE_DURATION_SECONDS } from '../data/mockSpeedDates';
import type { ActiveDateScreenProps } from '../navigation/types';

export function ActiveDateScreen({ navigation, route }: ActiveDateScreenProps) {
  const { partner } = route.params;
  const [secondsLeft, setSecondsLeft] = useState(DATE_DURATION_SECONDS);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);

  useEffect(() => {
    if (secondsLeft <= 0) {
      navigation.replace('PostDateFeedback', {
        partnerId: partner.id,
        dateId: `date-${Date.now()}`,
      });
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, navigation, partner.id]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = 1 - secondsLeft / DATE_DURATION_SECONDS;

  const handleEndEarly = () => {
    navigation.replace('PostDateFeedback', {
      partnerId: partner.id,
      dateId: `date-${Date.now()}`,
    });
  };

  return (
    <ScreenContainer style={styles.container} contentStyle={styles.content}>
      <View style={styles.timerBar}>
        <View style={[styles.timerFill, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={styles.timer}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </Text>
      <Text style={styles.timerLabel}>remaining</Text>

      <View style={styles.videoPlaceholder}>
        <Ionicons name="videocam" size={64} color={colors.primaryLight} />
        <Text style={styles.videoText}>Video call placeholder</Text>
        <Text style={styles.videoSub}>
          Real voice/video will connect here in a future update
        </Text>
      </View>

      <MatchCard user={partner} subtitle="Your speed date partner" />

      <View style={styles.controls}>
        <ControlButton
          icon={isMuted ? 'mic-off' : 'mic'}
          label={isMuted ? 'Unmute' : 'Mute'}
          onPress={() => setIsMuted(!isMuted)}
          active={isMuted}
        />
        <ControlButton
          icon={isVideoOn ? 'videocam' : 'videocam-off'}
          label={isVideoOn ? 'Video on' : 'Video off'}
          onPress={() => setIsVideoOn(!isVideoOn)}
          active={!isVideoOn}
        />
        <ControlButton
          icon="flag"
          label="Report"
          onPress={() => {}}
          variant="danger"
        />
      </View>

      <View style={styles.safety}>
        <Ionicons name="shield-checkmark" size={16} color={colors.success} />
        <Text style={styles.safetyText}>
          You can end this date at any time. Your comfort comes first.
        </Text>
      </View>

      <Button
        title="End date early"
        onPress={handleEndEarly}
        variant="outline"
        size="md"
      />
    </ScreenContainer>
  );
}

function ControlButton({
  icon,
  label,
  onPress,
  active = false,
  variant,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  variant?: 'danger';
}) {
  const iconColor =
    variant === 'danger' ? colors.error : active ? colors.primary : colors.textSecondary;

  return (
    <View style={styles.controlItem}>
      <Pressable
        onPress={onPress}
        style={[
          styles.controlBtn,
          active && styles.controlBtnActive,
          variant === 'danger' && styles.controlBtnDanger,
        ]}
      >
        <Ionicons name={icon} size={24} color={iconColor} />
      </Pressable>
      <Text style={styles.controlLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.text,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  timerBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    backgroundColor: colors.secondary,
  },
  timer: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.surface,
  },
  timerLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: spacing.lg,
  },
  videoPlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  videoText: {
    ...typography.subtitle,
    color: colors.surface,
    marginTop: spacing.sm,
  },
  videoSub: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.5)',
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginVertical: spacing.lg,
  },
  controlItem: {
    alignItems: 'center',
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
  },
  controlBtnDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  controlLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.6)',
    marginTop: spacing.xs,
  },
  safety: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    width: '100%',
  },
  safetyText: {
    ...typography.caption,
    color: colors.successLight,
    flex: 1,
  },
});
