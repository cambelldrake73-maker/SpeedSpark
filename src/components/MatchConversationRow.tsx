import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import type { Match, Message } from '../types';
import { getMessageThreadMeta } from '../utils/messageThread';

interface MatchConversationRowProps {
  match: Match;
  messages: Message[];
  currentUserId: string;
  lastReadAt?: string;
  onPress: () => void;
  onProfilePress: () => void;
}

export function MatchConversationRow({
  match,
  messages,
  currentUserId,
  lastReadAt,
  onPress,
  onProfilePress,
}: MatchConversationRowProps) {
  const { turn, hasUnread, lastMessage } = getMessageThreadMeta(
    messages,
    currentUserId,
    lastReadAt,
  );
  const preview = lastMessage?.text ?? match.lastMessage ?? 'Say hi 👋';
  const photo = match.user.photos.find(Boolean);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        hasUnread && styles.rowUnread,
        pressed && styles.rowPressed,
      ]}
    >
      <Pressable onPress={onProfilePress} style={styles.avatarBtn} hitSlop={4}>
        <View style={[styles.avatar, hasUnread && styles.avatarUnread]}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={24} color={colors.primaryLight} />
          )}
          {hasUnread ? <View style={styles.unreadDot} /> : null}
        </View>
      </Pressable>

      <View style={styles.copy}>
        <View style={styles.topLine}>
          <Pressable onPress={onProfilePress} hitSlop={4}>
            <Text style={[styles.name, hasUnread && styles.nameUnread]}>{match.user.name}</Text>
          </Pressable>
          {turn ? (
            <View style={[styles.turnBadge, turn === 'yours' ? styles.yourTurn : styles.theirTurn]}>
              <Text
                style={[
                  styles.turnText,
                  turn === 'yours' ? styles.yourTurnText : styles.theirTurnText,
                ]}
              >
                {turn === 'yours' ? 'Your turn' : 'Their turn'}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[styles.preview, hasUnread && styles.previewUnread]}
          numberOfLines={1}
        >
          {hasUnread ? `${match.user.name}: ${preview}` : preview}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={hasUnread ? colors.sparkOrange : colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  rowUnread: {
    backgroundColor: 'rgba(245, 130, 32, 0.08)',
    borderColor: colors.sparkOrange,
    borderLeftWidth: 4,
  },
  rowPressed: {
    opacity: 0.92,
  },
  avatarBtn: {
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarUnread: {
    borderWidth: 2,
    borderColor: colors.sparkOrange,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.sparkOrange,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  name: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  nameUnread: {
    fontWeight: '800',
    color: colors.text,
  },
  turnBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  yourTurn: {
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.sparkOrange,
  },
  theirTurn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  turnText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  yourTurnText: {
    color: colors.sparkOrange,
  },
  theirTurnText: {
    color: colors.textMuted,
  },
  preview: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  previewUnread: {
    color: colors.text,
    fontWeight: '600',
  },
});
