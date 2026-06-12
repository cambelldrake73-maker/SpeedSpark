import React from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  compact?: boolean;
  last?: boolean;
}

interface SettingsToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (enabled: boolean) => void;
  last?: boolean;
}

export function SettingsToggleRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  last = false,
}: SettingsToggleRowProps) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.rowPressed]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.sparkOrange} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.sparkOrange }}
        thumbColor={Platform.OS === 'android' && value ? colors.sparkOrange : colors.text}
        ios_backgroundColor={colors.border}
      />
    </Pressable>
  );
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  destructive = false,
  showChevron = true,
  compact = false,
  last = false,
}: SettingsRowProps) {
  const iconColor = destructive ? colors.error : colors.sparkOrange;
  const titleColor = destructive ? colors.error : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        compact && styles.rowCompact,
        last && styles.rowLast,
        pressed && onPress && styles.rowPressed,
        !onPress && styles.rowStatic,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          compact && styles.iconWrapCompact,
          destructive && styles.iconWrapDestructive,
        ]}
      >
        <Ionicons name={icon} size={compact ? 18 : 20} color={iconColor} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {onPress && showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  rowCompact: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  rowStatic: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  iconWrapDestructive: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  copy: {
    flex: 1,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  toggleTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  value: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
});
