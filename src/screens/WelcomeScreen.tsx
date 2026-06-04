import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BrandLogo, Button, ScreenContainer } from '../components';
import { COPY } from '../constants/options';
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
    <ScreenContainer scroll contentStyle={styles.page} style={styles.screen}>
      <View style={styles.heroBand}>
        <BrandLogo size="hero" centered />
        <Text style={styles.heroTitle}>{brand.tagline}</Text>
        <Text style={styles.heroDescription}>
          Scheduled five-minute video dates for the queer community — verified profiles,
          intentional matching, and mutual opt-in before you message.
        </Text>
        <View style={styles.scheduleCallout}>
          <Ionicons name="calendar-outline" size={18} color={colors.sparkOrange} />
          <Text style={styles.scheduleText}>{COPY.scheduledWindows}</Text>
        </View>
      </View>

      <View style={styles.flowSection}>
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
      </View>

      <View style={styles.featuresSection}>
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

      <View style={styles.detailsSection}>
        <Text style={styles.sectionLabel}>The details</Text>
        <View style={styles.howItWorks}>
          <Step n={1} text="Set up your profile + prefs" />
          <Step n={2} text="Join when a scheduled window opens" />
          <Step n={3} text="Five-min call → private survey → back in queue" />
          <Step n={4} text="Mutual match, or on to the next pairing" />
          <Text style={styles.detailsFootnote}>
            One pairing at a time, for as long as the window runs. Surveys capture masc/fem vibe,
            intentions, and a private appearance balance to match you more thoughtfully — never
            shared publicly.
          </Text>
        </View>
      </View>

      <View style={styles.ctaSection}>
        <Button
          title="Log in"
          onPress={() => navigation.navigate('Auth', { initialMode: 'login' })}
          size="lg"
        />
        <Pressable
          style={({ pressed }) => [styles.loginRow, pressed && styles.loginRowPressed]}
          onPress={() => navigation.navigate('Auth', { initialMode: 'signup' })}
          accessibilityRole="button"
        >
          <Text style={styles.loginText}>Don't have an account?</Text>
          <Text style={styles.loginLink}>Create account</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepNum}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
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
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { width: '100%' } : {}),
  },
  heroTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
    lineHeight: 26,
  },
  heroDescription: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
  },
  scheduleCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  scheduleText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  flowSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.sparkOrange,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
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
  featuresSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
  detailsSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  howItWorks: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.sparkRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  stepText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  detailsFootnote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  ctaSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  loginRowPressed: {
    opacity: 0.7,
  },
  loginText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  loginLink: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.sparkOrange,
  },
});
