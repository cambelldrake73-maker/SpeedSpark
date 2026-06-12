import React from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const feetValue = feet ?? '';
  const inchesValue = inches ?? '';

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, error ? styles.labelError : null]}>{label}</Text> : null}
      <View style={styles.messageSlot}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <View style={styles.row}>
        <View style={[styles.field, error ? styles.fieldError : null]}>
          <TextInput
            style={styles.input}
            value={feetValue}
            onChangeText={(v) => onFeetChange(sanitizeDigits(v, 1))}
            keyboardType="number-pad"
            showSoftInputOnFocus
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
            value={inchesValue}
            onChangeText={(v) => onInchesChange(sanitizeDigits(v, 2))}
            keyboardType="number-pad"
            showSoftInputOnFocus
            placeholder="6"
            placeholderTextColor={colors.textMuted}
            maxLength={2}
            accessibilityLabel="Inches"
          />
          <Text style={styles.unit}>in</Text>
        </View>
      </View>
      <View style={styles.hintSlot}>
        {!error ? <Text style={styles.hint}>Inches must be 0–11</Text> : null}
      </View>
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
  messageSlot: {
    minHeight: 18,
    justifyContent: 'center',
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
    minHeight: 48,
  },
  fieldError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: colors.text,
    padding: 0,
    minWidth: 24,
    textAlign: 'center',
    ...(Platform.OS === 'android'
      ? { textAlignVertical: 'center' as const, includeFontPadding: false }
      : {}),
  },
  unit: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  hintSlot: {
    minHeight: 18,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    lineHeight: 18,
  },
});
