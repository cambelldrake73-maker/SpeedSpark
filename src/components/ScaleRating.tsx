import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface ScaleRatingProps {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Hides the large selected number — selection shown on chips only. */
  compact?: boolean;
}

export function ScaleRating({
  label,
  hint,
  value,
  onChange,
  min = 1,
  max = 10,
  compact = false,
}: ScaleRatingProps) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {!compact && value > 0 ? <Text style={styles.selectedValue}>{value}</Text> : null}
      <View style={styles.grid}>
        {options.map((n) => (
          <Pressable
            key={n}
            style={[styles.chip, value === n && styles.chipActive]}
            onPress={() => onChange(n)}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${n} out of ${max}`}
          >
            <Text style={[styles.chipText, value === n && styles.chipTextActive]}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  containerCompact: {
    marginBottom: 0,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  selectedValue: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '700',
    color: colors.sparkOrange,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontVariant: ['tabular-nums'],
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: colors.sparkOrange,
    backgroundColor: colors.accentLight,
  },
  chipText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  chipTextActive: {
    color: colors.text,
  },
});
