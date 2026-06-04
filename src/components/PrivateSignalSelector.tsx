import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface PrivateSignalSelectorProps {
  title: string;
  hint: string;
  options: { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
}

/** Qualitative private signal — maps internally, never shown as a numeric score */
export function PrivateSignalSelector({
  title,
  hint,
  options,
  value,
  onChange,
}: PrivateSignalSelectorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
        <Text style={styles.headerText}>{title}</Text>
      </View>
      <Text style={styles.hint}>{hint}</Text>
      <View style={styles.options}>
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.option, value === opt.value && styles.optionSelected]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.optionText, value === opt.value && styles.optionTextSelected]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  optionText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: colors.primaryDark,
  },
});
