import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../constants/theme';

interface StarRatingProps {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

export function StarRating({ label, hint, value, onChange, max = 5 }: StarRatingProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.stars}>
        {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
          <Pressable key={star} onPress={() => onChange(star)} accessibilityLabel={`${star} of ${max}`}>
            <Ionicons
              name={star <= value ? 'star' : 'star-outline'}
              size={32}
              color={star <= value ? colors.warning : colors.border}
            />
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
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
