import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, MatchCard, ScreenContainer } from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { MOCK_PARTNER } from '../data/mockUsers';
import { useApp } from '../context/AppContext';
import type { MatchResultScreenProps } from '../navigation/types';

export function MatchResultScreen({ navigation }: MatchResultScreenProps) {
  const { lastFeedback, partnerFeedback } = useApp();

  const isMutualMatch =
    lastFeedback?.wouldTalkAgain === true &&
    partnerFeedback?.wouldTalkAgain === true;

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={styles.resultHeader}>
        {isMutualMatch ? (
          <>
            <View style={styles.matchIcon}>
              <Ionicons name="heart" size={48} color={colors.secondary} />
            </View>
            <Text style={styles.title}>It's a match! 🎉</Text>
            <Text style={styles.subtitle}>
              You and {MOCK_PARTNER.name} both want to keep talking. Start messaging!
            </Text>
          </>
        ) : (
          <>
            <View style={[styles.matchIcon, styles.noMatchIcon]}>
              <Ionicons name="heart-dislike-outline" size={48} color={colors.textMuted} />
            </View>
            <Text style={styles.title}>No match this time</Text>
            <Text style={styles.subtitle}>
              That's okay — not every speed date leads somewhere, and that's by design.
              Join the next window when you're ready.
            </Text>
          </>
        )}
      </View>

      <MatchCard
        user={MOCK_PARTNER}
        subtitle={isMutualMatch ? 'Your new match' : 'Your speed date partner'}
      />

      {isMutualMatch ? (
        <View style={styles.actions}>
          <Button
            title="Send a message"
            onPress={() => navigation.navigate('Messages', { matchId: 'match-1' })}
            size="lg"
          />
          <Button
            title="Back to lobby"
            onPress={() => navigation.navigate('SpeedDateLobby')}
            variant="ghost"
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={styles.encouragement}>
            <Text style={styles.encouragementText}>
              Each date teaches our matching system what works for you — privately and
              without ever showing scores publicly.
            </Text>
          </View>
          <Button
            title="Join another window"
            onPress={() => navigation.navigate('SpeedDateLobby')}
            size="lg"
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xxl,
    flex: 1,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  matchIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.secondaryLight,
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
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  encouragement: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  encouragementText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
