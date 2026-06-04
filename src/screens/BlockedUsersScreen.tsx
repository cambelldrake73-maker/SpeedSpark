import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, ScreenContainer } from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { useApp } from '../context/AppContext';
import type { BlockedUsersScreenProps } from '../navigation/types';

export function BlockedUsersScreen({ navigation }: BlockedUsersScreenProps) {
  const { blockedUsers, unblockUser } = useApp();
  const [pendingUnblock, setPendingUnblock] = useState<{ userId: string; name: string } | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const requestUnblock = (userId: string, name: string) => {
    setPendingUnblock({ userId, name });
  };

  const confirmUnblock = () => {
    if (!pendingUnblock) return;
    unblockUser(pendingUnblock.userId);
    setNotice(`${pendingUnblock.name} has been unblocked.`);
    setPendingUnblock(null);
  };

  return (
    <>
      <ScreenContainer scroll contentStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Blocked users</Text>
          <View style={styles.backBtn} />
        </View>

        <Text style={styles.intro}>
          Blocked people can't message you, join your speed dates, or appear in your matches. They
          aren't notified when you block or unblock them.
        </Text>

        {notice ? (
          <View style={styles.notice}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.noticeText}>{notice}</Text>
            <Pressable onPress={() => setNotice(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {blockedUsers.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No blocked users</Text>
            <Text style={styles.emptyText}>
              Block someone from a live call or message thread if you need space or feel unsafe.
              You can unblock them here anytime.
            </Text>
          </View>
        ) : (
          blockedUsers.map((blocked) => (
            <View key={blocked.userId} style={styles.row}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={22} color={colors.textSecondary} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowName}>{blocked.name}</Text>
                <Text style={styles.rowMeta}>
                  Blocked {new Date(blocked.blockedAt).toLocaleDateString()}
                </Text>
              </View>
              <Button
                title="Unblock"
                onPress={() => requestUnblock(blocked.userId, blocked.name)}
                size="sm"
                variant="outline"
              />
            </View>
          ))
        )}
      </ScreenContainer>

      <Modal
        visible={!!pendingUnblock}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingUnblock(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setPendingUnblock(null)}
            accessibilityLabel="Dismiss unblock confirmation"
          />
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="person-add-outline" size={28} color={colors.sparkOrange} />
            </View>
            <Text style={styles.modalTitle}>Unblock {pendingUnblock?.name}?</Text>
            <Text style={styles.modalText}>
              They will be able to match and message you again if you both match in the future.
            </Text>
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setPendingUnblock(null)}
                variant="outline"
                size="md"
                style={styles.modalBtn}
              />
              <Button title="Unblock" onPress={confirmUnblock} size="md" style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '700',
  },
  intro: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success,
  },
  noticeText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
  },
  rowName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  rowMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
  },
});
