import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import type { UserProfile } from '../types';
import {
  GENDER_OPTIONS,
  LOOKING_FOR_OPTIONS,
  ORIENTATION_OPTIONS,
  PRESENTATION_OPTIONS,
} from '../constants/options';

interface MatchCardProps {
  user: UserProfile;
  subtitle?: string;
  compact?: boolean;
}

function getLabel<T extends string>(
  options: { value: T; label: string }[],
  value: T,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function MatchCard({ user, subtitle, compact = false }: MatchCardProps) {
  const presLabels = user.presentationTags
    .filter((p) => p !== 'prefer_not_to_say')
    .map((p) => getLabel(PRESENTATION_OPTIONS, p));

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={[styles.avatar, compact && styles.avatarCompact]}>
        <Ionicons name="person" size={compact ? 32 : 40} color={colors.primaryLight} />
        {user.verificationStatus === 'verified' && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={10} color={colors.surface} />
          </View>
        )}
      </View>
      <Text style={styles.name}>
        {user.name}
        {user.age > 0 ? `, ${user.age}` : ''}
      </Text>
      {user.location ? <Text style={styles.location}>{user.location}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.tags}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{getLabel(GENDER_OPTIONS, user.genderIdentity)}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>
            {getLabel(ORIENTATION_OPTIONS, user.sexualOrientation)}
          </Text>
        </View>
        {user.lookingFor.slice(0, 2).map((lf) => (
          <View key={lf} style={styles.tag}>
            <Text style={styles.tagText}>{getLabel(LOOKING_FOR_OPTIONS, lf)}</Text>
          </View>
        ))}
        {presLabels.map((label) => (
          <View key={`p-${label}`} style={styles.tag}>
            <Text style={styles.tagText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardCompact: {
    padding: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarCompact: {
    width: 64,
    height: 64,
    marginBottom: spacing.sm,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  name: {
    ...typography.title,
    fontSize: 20,
    color: colors.text,
  },
  location: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  tagText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '500',
  },
});
