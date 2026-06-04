import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface ChipGridProps {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  maxSelect?: number;
}

export function ChipGrid({ options, selected, onToggle, maxSelect }: ChipGridProps) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isSelected = selected.includes(option);
        const atMax = maxSelect !== undefined && selected.length >= maxSelect && !isSelected;

        return (
          <Pressable
            key={option}
            style={[styles.chip, isSelected && styles.chipSelected, atMax && styles.chipDisabled]}
            onPress={() => !atMax && onToggle(option)}
            disabled={atMax}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
});
