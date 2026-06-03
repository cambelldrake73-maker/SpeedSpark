import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, ScreenContainer } from '../components';
import { borderRadius, colors, shadows, spacing, typography } from '../constants/theme';
import { MOCK_SPEED_DATE_WINDOWS } from '../data/mockSpeedDates';
import { MOCK_PARTNER, MOCK_QUEUE_USERS } from '../data/mockUsers';
import { useApp } from '../context/AppContext';
import type { SpeedDateLobbyScreenProps } from '../navigation/types';

type QueueStatus = 'idle' | 'searching' | 'matched';

export function SpeedDateLobbyScreen({ navigation }: SpeedDateLobbyScreenProps) {
  const { currentUser, setCurrentDatePartner } = useApp();
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [countdown, setCountdown] = useState(0);

  const liveWindow = MOCK_SPEED_DATE_WINDOWS.find((w) => w.isLive);
  const upcomingWindows = MOCK_SPEED_DATE_WINDOWS.filter((w) => !w.isLive);

  useEffect(() => {
    if (queueStatus !== 'searching') return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev + 1);
    }, 1000);

    const matchTimer = setTimeout(() => {
      setQueueStatus('matched');
      setCurrentDatePartner(MOCK_PARTNER);
    }, 3000);

    return () => {
      clearInterval(timer);
      clearTimeout(matchTimer);
    };
  }, [queueStatus, setCurrentDatePartner]);

  const handleJoinQueue = () => {
    setQueueStatus('searching');
    setCountdown(0);
  };

  const handleStartDate = () => {
    navigation.navigate('ActiveDate', { partner: MOCK_PARTNER });
  };

  const formatWindowTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {currentUser.name || 'there'} 👋</Text>
          <Text style={styles.headerSub}>Ready for your next connection?</Text>
        </View>
        <Button
          title="Messages"
          onPress={() => navigation.navigate('Messages', {})}
          variant="outline"
          size="sm"
        />
      </View>

      {liveWindow && (
        <View style={[styles.liveCard, shadows.md]}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE NOW</Text>
          </View>
          <Text style={styles.windowTitle}>{liveWindow.label}</Text>
          <Text style={styles.windowTime}>
            {formatWindowTime(liveWindow.startTime)} – {formatWindowTime(liveWindow.endTime)}
          </Text>
          <Text style={styles.queueCount}>
            {MOCK_QUEUE_USERS.length} people in queue nearby
          </Text>

          {queueStatus === 'idle' && (
            <Button title="Join the queue" onPress={handleJoinQueue} size="lg" style={styles.queueBtn} />
          )}

          {queueStatus === 'searching' && (
            <View style={styles.searching}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.searchingText}>Finding your match...</Text>
              <Text style={styles.searchingSub}>{countdown}s</Text>
            </View>
          )}

          {queueStatus === 'matched' && (
            <View style={styles.matched}>
              <Ionicons name="heart" size={32} color={colors.secondary} />
              <Text style={styles.matchedText}>You're matched with {MOCK_PARTNER.name}!</Text>
              <Button title="Start 5-min date" onPress={handleStartDate} size="lg" style={styles.queueBtn} />
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Upcoming windows</Text>
      {upcomingWindows.map((window) => (
        <View key={window.id} style={styles.upcomingCard}>
          <Text style={styles.upcomingTitle}>{window.label}</Text>
          <Text style={styles.upcomingTime}>{formatWindowTime(window.startTime)}</Text>
          <Button title="Set reminder" variant="ghost" size="sm" onPress={() => {}} />
        </View>
      ))}

      <View style={styles.tips}>
        <Text style={styles.tipsTitle}>Speed date tips</Text>
        <Tip text="Find a quiet spot with good lighting" />
        <Tip text="Be yourself — 5 minutes goes fast!" />
        <Tip text="You can end early if you feel uncomfortable" />
      </View>
    </ScreenContainer>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={styles.tipRow}>
      <Text style={styles.tipBullet}>•</Text>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.title,
    color: colors.text,
  },
  headerSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  liveCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  liveText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 1,
  },
  windowTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  windowTime: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  queueCount: {
    ...typography.caption,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  queueBtn: {
    marginTop: spacing.sm,
  },
  searching: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  searchingText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  searchingSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  matched: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  matchedText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.md,
  },
  upcomingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  upcomingTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  upcomingTime: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  tips: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  tipsTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tipBullet: {
    color: colors.primary,
  },
  tipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
});
