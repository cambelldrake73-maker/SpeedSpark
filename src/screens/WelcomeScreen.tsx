import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, ScreenContainer } from '../components';
import { colors, spacing, typography } from '../constants/theme';
import type { WelcomeScreenProps } from '../navigation/types';

export function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  return (
    <ScreenContainer style={styles.container}>
      <LinearGradient
        colors={[colors.surfaceAlt, colors.background, colors.background]}
        style={styles.gradient}
      >
        <View style={styles.hero}>
          <Text style={styles.emoji}>🌈</Text>
          <Text style={styles.title}>Spark</Text>
          <Text style={styles.tagline}>
            Real connections, not endless swiping
          </Text>
          <Text style={styles.description}>
            Free-first speed dating for the queer community. Five-minute voice and
            video dates, verified profiles, and matches built on mutual interest —
            not paywalls.
          </Text>
        </View>

        <View style={styles.features}>
          <FeatureItem icon="✓" text="100% free core experience" />
          <FeatureItem icon="✓" text="Identity-verified community" />
          <FeatureItem icon="✓" text="Scheduled 5-min speed dates" />
          <FeatureItem icon="✓" text="Match only when you both want more" />
        </View>

        <View style={styles.actions}>
          <Button
            title="Get Started"
            onPress={() => navigation.navigate('Auth')}
            size="lg"
          />
          <Button
            title="How it works"
            onPress={() => navigation.navigate('Auth')}
            variant="ghost"
            size="md"
          />
        </View>
      </LinearGradient>
    </ScreenContainer>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.hero,
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.subtitle,
    color: colors.secondary,
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  features: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureIcon: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 16,
  },
  featureText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  actions: {
    gap: spacing.sm,
  },
});
