import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';

interface StatStripProps {
  datesThisWeek: number;
  matches: number;
  queueLabel: string;
}

/** Display-only stats — flat bar, not tappable cards */
export function StatStrip({ datesThisWeek, matches, queueLabel }: StatStripProps) {
  return (
    <View style={styles.bar}>
      <Stat value={String(datesThisWeek)} label="Dates this week" />
      <View style={styles.divider} />
      <Stat value={String(matches)} label="Matches" />
      <View style={styles.divider} />
      <Stat value={queueLabel} label="Queue" emphasize />
    </View>
  );
}

function Stat({
  value,
  label,
  emphasize,
}: {
  value: string;
  label: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.value, emphasize && styles.valueEmphasize]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  value: {
    ...typography.subtitle,
    fontSize: 18,
    color: colors.text,
  },
  valueEmphasize: {
    color: colors.primary,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
});
