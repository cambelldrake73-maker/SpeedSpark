import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QueueStatusPanel, ScreenContainer } from '../components';
import { colors, spacing, typography } from '../constants/theme';
import { MOCK_PARTNER } from '../data/mockUsers';
import { useApp } from '../context/AppContext';
import type { DateQueueScreenProps } from '../navigation/types';

export function DateQueueScreen({ navigation }: DateQueueScreenProps) {
  const { isOnboarded, windowIdentityVerified, setCurrentDatePartner } = useApp();
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!isOnboarded) {
      navigation.replace('ProfileCreation');
      return;
    }

    if (!windowIdentityVerified) {
      navigation.replace('Verification', { context: 'window' });
      return;
    }

    setStarted(true);
  }, [isOnboarded, windowIdentityVerified, navigation]);

  useEffect(() => {
    if (!started) return;

    const tick = setInterval(() => setSearchSeconds((s) => s + 1), 1000);
    const matchTimer = setTimeout(() => {
      setCurrentDatePartner(MOCK_PARTNER);
      navigation.replace('ActiveDate', { partner: MOCK_PARTNER });
    }, 2800);

    return () => {
      clearInterval(tick);
      clearTimeout(matchTimer);
    };
  }, [started, navigation, setCurrentDatePartner]);

  const handleLeaveQueue = () => {
    navigation.replace('SpeedDateLobby');
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>You're in the queue</Text>
        <Text style={styles.subtitle}>
          Hang tight — we'll pair you into your next 5-minute date automatically.
        </Text>
      </View>

      <QueueStatusPanel
        status="searching"
        searchSeconds={searchSeconds}
        identityVerified={windowIdentityVerified}
        onJoinQueue={() => {}}
        onLeaveQueue={handleLeaveQueue}
        onVerifyIdentity={() => navigation.replace('Verification', { context: 'window' })}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: spacing.xxl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
