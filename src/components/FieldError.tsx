import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';

interface FieldErrorProps {
  message?: string;
}

export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;

  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  error: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
});
