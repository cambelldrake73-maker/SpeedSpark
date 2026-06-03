import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface TagSelectorProps<T extends string> {
  options: { value: T; label: string; description?: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  multiSelect?: boolean;
}

export function TagSelector<T extends string>({
  options,
  selected,
  onToggle,
  multiSelect = true,
}: TagSelectorProps<T>) {
  const handlePress = (value: T) => {
    if (!multiSelect) {
      onToggle(value);
      return;
    }
    onToggle(value);
  };

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => handlePress(option.value)}
            style={[styles.tag, isSelected && styles.tagSelected]}
          >
            <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
              {option.label}
            </Text>
            {option.description && (
              <Text style={[styles.description, isSelected && styles.descriptionSelected]}>
                {option.description}
              </Text>
            )}
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
  },
  tag: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tagSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  tagText: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.text,
  },
  tagTextSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  description: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  descriptionSelected: {
    color: colors.primary,
  },
});
