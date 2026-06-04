import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandLogo } from './BrandLogo';
import { colors, spacing, typography } from '../constants/theme';
import type { UserProfile } from '../types';

interface LobbyHeaderProps {
  user: UserProfile;
  onMessagesPress: () => void;
  onSettingsPress: () => void;
  unreadCount?: number;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

export function LobbyHeader({
  user,
  onMessagesPress,
  onSettingsPress,
  unreadCount = 0,
}: LobbyHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <BrandLogo size="auth" style={styles.logo} />
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            onPress={onSettingsPress}
            accessibilityLabel="Open settings"
          >
            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.messagesBtn, pressed && styles.messagesBtnPressed]}
            onPress={onMessagesPress}
            accessibilityRole="button"
            accessibilityLabel="Open messages"
          >
            <Ionicons name="chatbubbles-outline" size={20} color={colors.sparkOrange} />
            <Text style={styles.messagesBtnText}>Messages</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <Text style={styles.greeting}>Hey, {firstName(user.name || 'there')}</Text>
      <Text style={styles.sub}>
        {user.location ? `${user.location} · ` : ''}
        Speed dating lobby
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  logo: {
    flex: 1,
    maxWidth: '62%',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    opacity: 0.85,
    backgroundColor: colors.surfaceAlt,
  },
  greeting: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
  },
  sub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  messagesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.sparkOrange,
    backgroundColor: colors.surface,
  },
  messagesBtnPressed: {
    opacity: 0.85,
    backgroundColor: colors.surfaceAlt,
  },
  messagesBtnText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.sparkOrange,
  },
  badge: {
    marginLeft: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
});
