import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import type { MatchCompatibility } from '../utils/matching';
import type { UserProfile } from '../types';
import {
  GENDER_OPTIONS,
  LOOKING_FOR_OPTIONS,
  ORIENTATION_OPTIONS,
  PRESENTATION_OPTIONS,
  QUEER_ROLE_OPTIONS,
} from '../constants/options';

interface CompatibilityCardProps {
  partner: UserProfile;
  compatibility: MatchCompatibility;
}

function labelFor<T extends string>(options: { value: T; label: string }[], value: T) {
  return options.find((o) => o.value === value)?.label ?? value;
}

/** Display-only match preview — no shadow / button styling */
export function CompatibilityCard({ partner, compatibility }: CompatibilityCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={28} color={colors.primaryLight} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name}>{partner.name}, {partner.age}</Text>
          <Text style={styles.location}>{partner.location}</Text>
        </View>
        <View style={styles.fitBadge}>
          <Text style={styles.fitValue}>{compatibility.score}%</Text>
          <Text style={styles.fitLabel}>match fit</Text>
        </View>
      </View>

      <View style={styles.tags}>
        <MiniTag text={labelFor(GENDER_OPTIONS, partner.genderIdentity)} />
        <MiniTag text={labelFor(ORIENTATION_OPTIONS, partner.sexualOrientation)} />
        {partner.lookingFor.slice(0, 1).map((lf) => (
          <MiniTag key={lf} text={labelFor(LOOKING_FOR_OPTIONS, lf)} />
        ))}
      </View>

      {compatibility.highlights.length > 0 && (
        <View style={styles.highlights}>
          {compatibility.highlights.map((h) => (
            <Text key={h} style={styles.highlightText}>
              · {h}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function MiniTag({ text }: { text: string }) {
  return (
    <View style={styles.miniTag}>
      <Text style={styles.miniTagText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  name: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  location: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  fitBadge: {
    alignItems: 'flex-end',
  },
  fitValue: {
    ...typography.subtitle,
    fontSize: 16,
    color: colors.primary,
  },
  fitLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  miniTag: {
    backgroundColor: colors.surface,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  miniTagText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  highlights: {
    gap: 2,
  },
  highlightText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
