import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  LobbyHeader,
  QueueStatusPanel,
  ScreenContainer,
  type QueueStatus,
} from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
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
    demoMatches,
  } = useApp();
  const { session } = useAuth();
  const lobby = useLobbyBackend(session?.user?.id ?? currentUser.id);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [searchSeconds, setSearchSeconds] = useState(0);

  const liveWindow = lobby.liveWindow;
  const upcomingWindows = lobby.upcomingWindows;

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

  const formatWindowTime = (iso: string) =>
    new Date(iso).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <ScreenContainer scroll={true} contentStyle={styles.content}>
      <LobbyHeader
        user={currentUser}
        onMessagesPress={() => navigation.navigate('Messages', {})}
        onSettingsPress={() => navigation.navigate('Settings')}
        unreadCount={demoMatches.length}
      />

      {liveWindow && (
        <View style={styles.liveSection}>
          <View style={styles.liveSectionHead}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE NOW</Text>
            </View>
          </View>

          <Text style={styles.windowTitle}>{liveWindow.label}</Text>
          <Text style={styles.windowTime}>
            {formatWindowTime(liveWindow.startTime)} – {formatWindowTime(liveWindow.endTime)}
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
      {upcomingWindows.map((window) => (
        <UpcomingRow key={window.id} window={window} formatTime={formatWindowTime} />
      ))}

    </ScreenContainer>
  );
}

function UpcomingRow({
  window,
  formatTime,
}: {
  window: SpeedDateWindow;
  formatTime: (iso: string) => string;
}) {
  return (
    <View style={styles.upcomingRow}>
      <Text style={styles.upcomingTitle}>{window.label}</Text>
      <Text style={styles.upcomingTime}>
        {formatTime(window.startTime)} – {formatTime(window.endTime)}
      </Text>
      {window.description ? (
        <Text style={styles.upcomingDesc}>{window.description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
});
