import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';

interface SectionHeaderProps {
  title: string;
  hint?: string;
  error?: string;
}

export function SectionHeader({ title, hint, error }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, error ? styles.titleError : null]}>{title}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  titleError: {
    color: colors.error,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});
