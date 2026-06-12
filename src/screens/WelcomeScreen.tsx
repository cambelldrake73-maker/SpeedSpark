import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BrandLogo, Button, ScreenContainer } from '../components';
import { brand, borderRadius, colors, spacing, typography } from '../constants/theme';
import type { WelcomeScreenProps } from '../navigation/types';

const FLOW_STEPS = [
  { icon: 'person' as const, label: 'Profile' },
  { icon: 'flash' as const, label: 'Queue' },
  { icon: 'videocam' as const, label: '5 min' },
  { icon: 'heart' as const, label: 'Match' },
];

const PERKS = [
  'Free to join',
  'Verified members',
  'No endless swiping',
  'Mutual matches only',
];

export function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  return (
    <ScreenContainer scroll={true} contentStyle={styles.page} style={styles.screen}>
      <View style={styles.heroBand}>
        <BrandLogo size="hero" centered style={styles.heroLogo} />
        <Text style={styles.heroTitle}>{brand.tagline}</Text>
        <Text style={styles.heroDescription}>
          Five-minute video dates at scheduled windows.
        </Text>
      </View>

      <View style={styles.ctaSection}>
        <Button
          title="Log in"
          onPress={() => navigation.navigate('Auth', { initialMode: 'login' })}
          size="lg"
        />
        <Pressable
          style={({ pressed }) => [styles.signupRow, pressed && styles.signupRowPressed]}
          onPress={() => navigation.navigate('Auth', { initialMode: 'signup' })}
          accessibilityRole="button"
        >
          <Text style={styles.signupText}>Don't have an account?</Text>
          <Text style={styles.signupLink}>Create account</Text>
        </Pressable>
      </View>

      <View style={styles.explainerSection}>
        <Text style={styles.sectionLabel}>The flow</Text>
        <View style={styles.flowCard}>
          <LinearGradient
            colors={[colors.sparkRed, colors.sparkOrange, colors.sparkGold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.flowGradientBar}
          />
          <View style={styles.flowTrack}>
            <View style={styles.flowLine} />
            <View style={styles.flowNodes}>
              {FLOW_STEPS.map((step) => (
                <View key={step.label} style={styles.flowNode}>
                  <View style={styles.flowIconRing}>
                    <Ionicons name={step.icon} size={18} color={colors.sparkOrange} />
                  </View>
                  <Text style={styles.flowLabel}>{step.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Why SpeedSpark</Text>
        <View style={styles.perkGrid}>
          {PERKS.map((perk) => (
            <View key={perk} style={styles.perkChip}>
              <View style={styles.perkDot} />
              <Text style={styles.perkText}>{perk}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  page: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: spacing.xxl,
  },
  heroBand: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { width: '100%' } : {}),
  },
  heroLogo: {
    marginBottom: -spacing.sm,
  },
  heroTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: -spacing.sm,
    marginBottom: spacing.xs,
    textAlign: 'center',
    lineHeight: 26,
  },
  heroDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  ctaSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  signupRowPressed: {
    opacity: 0.7,
  },
  signupText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  signupLink: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.sparkOrange,
  },
  explainerSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.sparkOrange,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  flowCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  flowGradientBar: {
    height: 3,
    width: '100%',
  },
  flowTrack: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  flowLine: {
    position: 'absolute',
    top: 38,
    left: spacing.lg,
    right: spacing.lg,
    height: 2,
    backgroundColor: colors.border,
  },
  flowNodes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  flowNode: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  flowIconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.sparkOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  flowLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  perkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  perkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  perkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sparkOrange,
  },
  perkText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
});
