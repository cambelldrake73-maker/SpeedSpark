import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface HeightFieldsProps {
  label?: string;
  feet: string;
  inches: string;
  onFeetChange: (value: string) => void;
  onInchesChange: (value: string) => void;
  error?: string;
}

function sanitizeDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

export function HeightFields({
  label,
  feet,
  inches,
  onFeetChange,
  onInchesChange,
  error,
}: HeightFieldsProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, error ? styles.labelError : null]}>{label}</Text> : null}
      <View style={styles.row}>
        <View style={[styles.field, error ? styles.fieldError : null]}>
          <TextInput
            style={styles.input}
            value={feet}
            onChangeText={(v) => onFeetChange(sanitizeDigits(v, 1))}
            keyboardType="number-pad"
            placeholder="5"
            placeholderTextColor={colors.textMuted}
            maxLength={1}
            accessibilityLabel="Feet"
          />
          <Text style={styles.unit}>ft</Text>
        </View>
        <View style={[styles.field, error ? styles.fieldError : null]}>
          <TextInput
            style={styles.input}
            value={inches}
            onChangeText={(v) => onInchesChange(sanitizeDigits(v, 2))}
            keyboardType="number-pad"
            placeholder="6"
            placeholderTextColor={colors.textMuted}
            maxLength={2}
            accessibilityLabel="Inches"
          />
          <Text style={styles.unit}>in</Text>
        </View>
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={styles.hint}>Inches must be 0–11</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  labelError: {
    color: colors.error,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  fieldError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
    minWidth: 24,
  },
  unit: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});
