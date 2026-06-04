import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface FormErrorBannerProps {
  messages: string[];
}

export function FormErrorBanner({ messages }: FormErrorBannerProps) {
  if (messages.length === 0) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={20} color={colors.error} />
      <View style={styles.content}>
        <Text style={styles.title}>Fix these to continue:</Text>
        {messages.map((message) => (
          <Text key={message} style={styles.item}>
            • {message}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.error,
  },
  item: {
    ...typography.caption,
    color: colors.error,
    lineHeight: 18,
  },
});
