import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { textInputMetrics } from '../utils/platformStyles';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  /** Read-only field (e.g. age set at sign-up). */
  locked?: boolean;
}

export function Input({ label, error, hint, locked, style, editable, showSoftInputOnFocus, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput
        style={[styles.input, locked && styles.inputLocked, error && styles.inputError, style]}
        placeholderTextColor={colors.textMuted}
        editable={locked ? false : editable ?? true}
        showSoftInputOnFocus={locked ? false : showSoftInputOnFocus ?? true}
        {...props}
      />
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    ...textInputMetrics(),
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputLocked: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textSecondary,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
