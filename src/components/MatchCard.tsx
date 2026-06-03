import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, shadows, spacing, typography } from '../constants/theme';
import type { UserProfile } from '../types';
import { GENDER_OPTIONS, LOOKING_FOR_OPTIONS, ORIENTATION_OPTIONS } from '../constants/options';

interface MatchCardProps {
  user: UserProfile;
  subtitle?: string;
}

function getLabel<T extends string>(
  options: { value: T; label: string }[],
  value: T,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function MatchCard({ user, subtitle }: MatchCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={40} color={colors.primaryLight} />
      </View>
      <Text style={styles.name}>{user.name}, {user.age}</Text>
      <Text style={styles.location}>{user.location}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
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
    ...shadows.md,
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
  name: {
    ...typography.title,
    color: colors.text,
  },
  location: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
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
