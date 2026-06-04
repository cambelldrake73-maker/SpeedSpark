import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, DatingProfileCard, ScreenContainer } from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { MOCK_PARTNER } from '../data/mockUsers';
import { useApp } from '../context/AppContext';
import type { MatchResultScreenProps } from '../navigation/types';

export function MatchResultScreen({ navigation }: MatchResultScreenProps) {
  const { lastFeedback, partnerFeedback, currentDatePartner } = useApp();
  const partner = currentDatePartner ?? MOCK_PARTNER;

  const isMutualMatch =
    lastFeedback?.wouldTalkAgain === true &&
    partnerFeedback?.wouldTalkAgain === true;

  const joinNextDate = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'DateQueue' }],
    });
  };

  const backToLobby = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'SpeedDateLobby' }],
    });
  };

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <View style={styles.resultHeader}>
        {isMutualMatch ? (
          <>
            <View style={styles.matchIcon}>
              <Ionicons name="heart" size={48} color={colors.primary} />
            </View>
            <Text style={styles.title}>It's a mutual match!</Text>
            <Text style={styles.subtitle}>
              You and {partner.name} both want to keep talking. Send a message, or jump back in the
              queue for another date.
            </Text>
          </>
        ) : (
          <>
            <View style={[styles.matchIcon, styles.noMatchIcon]}>
              <Ionicons name="leaf-outline" size={48} color={colors.primaryLight} />
            </View>
            <Text style={styles.title}>Not a mutual match this time</Text>
            <Text style={styles.subtitle}>
              That's completely okay. When you're ready, join the queue for your next speed date.
            </Text>
          </>
        )}
      </View>

      <DatingProfileCard user={partner} />

      <View style={styles.actions}>
        <Button title="Join next date" onPress={joinNextDate} size="lg" />
        {isMutualMatch ? (
          <Button
            title="Send a message"
            onPress={() => navigation.navigate('Messages', { matchId: 'match-1' })}
            variant="outline"
            size="lg"
          />
        ) : (
          <View style={styles.encouragement}>
            <Text style={styles.encouragementText}>
              Your private attractiveness rating helps us pair you better next time. Nothing is
              shared publicly or shown on your profile.
            </Text>
          </View>
        )}
        <Button title="Back to lobby" onPress={backToLobby} variant="ghost" size="md" />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  matchIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  noMatchIcon: {
    backgroundColor: colors.surfaceAlt,
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
    paddingHorizontal: spacing.md,
    lineHeight: 24,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
    width: '100%',
  },
  encouragement: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
  },
  encouragementText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
