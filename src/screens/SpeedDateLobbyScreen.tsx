import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  LobbyHeader,
  QueueStatusPanel,
  ScreenContainer,
  StatStrip,
  type QueueStatus,
} from '../components';
import { COPY } from '../constants/options';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { MOCK_SPEED_DATE_WINDOWS } from '../data/mockSpeedDates';
import { MOCK_MATCHES } from '../data/mockMessages';
import { MOCK_PARTNER } from '../data/mockUsers';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useLobbyBackend } from '../hooks/useLobbyBackend';
import { useSpeedDatePairDetection } from '../hooks/useSpeedDatePairDetection';
import type { SpeedDateWindow } from '../types';
import type { SpeedDateLobbyScreenProps } from '../navigation/types';

export function SpeedDateLobbyScreen({ navigation }: SpeedDateLobbyScreenProps) {
  const {
    currentUser,
    windowIdentityVerified,
    isOnboarded,
    setCurrentDatePartner,
  } = useApp();
  const { session } = useAuth();
  const lobby = useLobbyBackend(session?.user?.id ?? currentUser.id);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [reminderWindowIds, setReminderWindowIds] = useState<Set<string>>(new Set());

  const liveWindow = lobby.liveWindow;
  const upcomingWindows = lobby.upcomingWindows;

  const queueLabel = queueStatus === 'idle' ? 'Open' : 'Pairing';

  useFocusEffect(
    useCallback(() => {
      if (!isOnboarded) {
        navigation.replace('ProfileCreation');
        return;
      }

      setQueueStatus('idle');
      setSearchSeconds(0);
    }, [isOnboarded, navigation]),
  );

  useEffect(() => {
    if (queueStatus !== 'searching') return;

    const tick = setInterval(() => setSearchSeconds((s) => s + 1), 1000);

    if (lobby.useBackend) {
      return () => clearInterval(tick);
    }

    const matchTimer = setTimeout(() => {
      setCurrentDatePartner(MOCK_PARTNER);
      setQueueStatus('idle');
      setSearchSeconds(0);
      navigation.navigate('ActiveDate', { partner: MOCK_PARTNER });
    }, 2800);

    return () => {
      clearInterval(tick);
      clearTimeout(matchTimer);
    };
  }, [queueStatus, navigation, setCurrentDatePartner, lobby.useBackend]);

  useSpeedDatePairDetection({
    userId: session?.user?.id ?? currentUser.id,
    enabled: lobby.useBackend && queueStatus === 'searching',
    onPaired: ({ partner, speedDateId }) => {
      setCurrentDatePartner(partner);
      setQueueStatus('idle');
      setSearchSeconds(0);
      navigation.navigate('ActiveDate', { partner, speedDateId });
    },
  });

  const handleVerifyIdentity = () => {
    navigation.navigate('Verification', { context: 'window' });
  };

  const handleJoinQueue = async () => {
    if (!isOnboarded) {
      navigation.replace('ProfileCreation');
      return;
    }
    if (!windowIdentityVerified) {
      handleVerifyIdentity();
      return;
    }
    if (lobby.useBackend) {
      const joined = await lobby.joinQueue();
      if (joined) {
        setQueueStatus('searching');
        setSearchSeconds(0);
      }
      return;
    }
    setQueueStatus('searching');
    setSearchSeconds(0);
  };

  const handleLeaveQueue = async () => {
    if (lobby.useBackend) {
      await lobby.leaveQueue();
    }
    setQueueStatus('idle');
    setSearchSeconds(0);
  };

  const toggleReminder = (windowId: string) => {
    setReminderWindowIds((prev) => {
      const next = new Set(prev);
      if (next.has(windowId)) next.delete(windowId);
      else next.add(windowId);
      return next;
    });
  };

  const formatWindowTime = (iso: string) =>
    new Date(iso).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <LobbyHeader
        user={currentUser}
        onMessagesPress={() => navigation.navigate('Messages', {})}
        onSettingsPress={() => navigation.navigate('Settings')}
        unreadCount={MOCK_MATCHES.length}
      />

      <StatStrip
        datesThisWeek={2}
        matches={MOCK_MATCHES.length}
        queueLabel={queueLabel}
      />

      <View style={styles.notice}>
        <Ionicons name="calendar-outline" size={18} color={colors.sparkOrange} />
        <Text style={styles.noticeText}>{COPY.scheduledWindows}</Text>
      </View>

      {liveWindow && (
        <View style={styles.liveSection}>
          <View style={styles.liveSectionHead}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE NOW</Text>
            </View>
          </View>

          <Text style={styles.windowTitle}>{liveWindow.label}</Text>
          <Text style={styles.windowDesc}>{liveWindow.description}</Text>
          <Text style={styles.windowTime}>
            {formatWindowTime(liveWindow.startTime)} – {formatWindowTime(liveWindow.endTime)}
          </Text>
          <Text style={styles.queueMeta}>
            {lobby.waitingCount} people in queue nearby · 5 min per date
          </Text>
          {lobby.error ? (
            <Text style={styles.backendError}>{lobby.error}</Text>
          ) : null}

          <View style={styles.queueArea}>
            <QueueStatusPanel
              status={queueStatus}
              searchSeconds={searchSeconds}
              identityVerified={windowIdentityVerified}
              onJoinQueue={handleJoinQueue}
              onLeaveQueue={handleLeaveQueue}
              onVerifyIdentity={handleVerifyIdentity}
            />
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Upcoming windows</Text>
      <Text style={styles.sectionSub}>
        Scheduled times — no endless scrolling.
      </Text>
      {upcomingWindows.map((window) => (
        <UpcomingRow
          key={window.id}
          window={window}
          formatTime={formatWindowTime}
          reminded={reminderWindowIds.has(window.id)}
          onToggleReminder={() => toggleReminder(window.id)}
        />
      ))}

      <View style={styles.tips}>
        <Text style={styles.tipsTitle}>Why SpeedSpark is different</Text>
        <Tip text="Your profile includes masc/fem vibe and who you're looking for — not just photos" />
        <Tip text="A safety check before each window confirms people match their photos before video dates" />
        <Tip text="Post-date you rate attractiveness privately — never shown on anyone's profile" />
      </View>
    </ScreenContainer>
  );
}

function UpcomingRow({
  window,
  formatTime,
  reminded,
  onToggleReminder,
}: {
  window: SpeedDateWindow;
  formatTime: (iso: string) => string;
  reminded: boolean;
  onToggleReminder: () => void;
}) {
  return (
    <View style={styles.upcomingRow}>
      <View style={styles.upcomingMain}>
        <View style={styles.upcomingHead}>
          <Text style={styles.upcomingTitle}>{window.label}</Text>
          <View style={styles.notLiveBadge}>
            <Text style={styles.notLiveBadgeText}>NOT LIVE</Text>
          </View>
        </View>
        <Text style={styles.upcomingTime}>{formatTime(window.startTime)}</Text>
        <Text style={styles.upcomingDesc}>{window.description}</Text>
        {reminded ? (
          <Text style={styles.reminderNote}>We'll text you before this window goes live.</Text>
        ) : null}
      </View>
      <Button
        title={reminded ? 'Reminder on' : 'Remind me'}
        variant={reminded ? 'outline' : 'ghost'}
        size="sm"
        onPress={onToggleReminder}
        style={styles.remindBtn}
      />
    </View>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={styles.tipRow}>
      <Text style={styles.tipBullet}>·</Text>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  noticeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  liveSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  liveSectionHead: {
    marginBottom: spacing.sm,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  liveBadgeText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 0.5,
  },
  windowTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  windowDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  windowTime: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  queueMeta: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  backendError: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  queueArea: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  upcomingMain: {
    flex: 1,
  },
  upcomingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  notLiveBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  notLiveBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  upcomingTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  upcomingTime: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  upcomingDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  reminderNote: {
    ...typography.caption,
    color: colors.success,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  remindBtn: {
    flexShrink: 0,
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
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tipBullet: {
    color: colors.textMuted,
  },
  tipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});
