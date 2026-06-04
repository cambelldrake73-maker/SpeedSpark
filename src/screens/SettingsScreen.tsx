import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, ScreenContainer, SettingsRow, SettingsSection, SettingsToggleRow } from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { SettingsScreenProps } from '../navigation/types';

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const {
    currentUser,
    logout,
    deleteAccount,
    textNotificationsEnabled,
    setTextNotificationsEnabled,
    blockedUsers,
  } = useApp();
  const { isSupabaseEnabled, signOut } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSignOut = async () => {
    if (isSupabaseEnabled) {
      await signOut();
    }
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteAccount();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  return (
    <>
    <ScreenContainer scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={28} color={colors.textSecondary} />
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{currentUser.name || 'Your profile'}</Text>
          <Text style={styles.profileMeta}>
            {currentUser.age > 0 ? `${currentUser.age} · ` : ''}
            {currentUser.location || 'Location not set'}
          </Text>
        </View>
      </View>

      <SettingsSection title="Profile">
        <SettingsRow
          icon="create-outline"
          title="Manage profile"
          subtitle="Photos, basics, tags, and location"
          onPress={() => navigation.navigate('ManageProfile')}
        />
        <SettingsRow
          icon="options-outline"
          title="Match preferences"
          subtitle="Age, distance, dealbreakers, and more"
          onPress={() => navigation.navigate('Preferences', { fromSettings: true })}
          last
        />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <SettingsToggleRow
          icon="chatbubble-outline"
          title="Text messages"
          subtitle="Texts when a speed date window is going live, plus reminders before it starts"
          value={textNotificationsEnabled}
          onValueChange={setTextNotificationsEnabled}
          last
        />
      </SettingsSection>
      <Text style={styles.notificationsNote}>
        {Platform.OS === 'web'
          ? 'On web, texts are how we let you know a window is about to go live. App push alerts are not available here.'
          : 'In-app messages and live alerts use Apple push notifications — manage those in iOS Settings.'}
      </Text>

      <SettingsSection title="App">
        <SettingsRow
          icon="lock-closed-outline"
          title="Privacy"
          subtitle="What we collect and what stays private"
          onPress={() => navigation.navigate('LegalDocument', { documentId: 'privacy' })}
        />
        <SettingsRow
          icon="ban-outline"
          title="Blocked users"
          subtitle="Manage people you've blocked"
          value={blockedUsers.length > 0 ? String(blockedUsers.length) : 'None'}
          onPress={() => navigation.navigate('BlockedUsers')}
          last
        />
      </SettingsSection>

      <SettingsSection title="Support">
        <SettingsRow
          icon="help-circle-outline"
          title="Help center"
          subtitle="Speed dates, safety, and account help"
          onPress={() => navigation.navigate('LegalDocument', { documentId: 'help' })}
        />
        <SettingsRow
          icon="document-text-outline"
          title="Terms & community guidelines"
          subtitle="Terms of service and community rules"
          onPress={() => navigation.navigate('LegalDocument', { documentId: 'terms' })}
        />
        <SettingsRow
          icon="people-outline"
          title="Community guidelines"
          subtitle="Respect, consent, and safety expectations"
          onPress={() => navigation.navigate('LegalDocument', { documentId: 'community' })}
          last
        />
      </SettingsSection>

      <SettingsSection title="Account">
        <SettingsRow icon="log-out-outline" title="Sign out" onPress={handleSignOut} />
        <SettingsRow
          icon="trash-outline"
          title="Delete account"
          subtitle="Permanently remove your data"
          onPress={handleDeleteAccount}
          destructive
          last
        />
      </SettingsSection>

      <Text style={styles.version}>SpeedSpark · MVP demo build</Text>
    </ScreenContainer>

      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowDeleteConfirm(false)}
            accessibilityLabel="Dismiss delete confirmation"
          />
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning-outline" size={28} color={colors.error} />
            </View>
            <Text style={styles.modalTitle}>Delete your account?</Text>
            <Text style={styles.modalText}>
              This permanently removes your profile, matches, and messages. This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowDeleteConfirm(false)}
                variant="outline"
                size="md"
                style={styles.modalBtn}
              />
              <Button title="Delete account" onPress={confirmDelete} size="md" style={styles.modalBtn} />
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
    marginBottom: spacing.lg,
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: {
    flex: 1,
  },
  profileName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  profileMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  notificationsNote: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.xs,
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
    borderColor: colors.error,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
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
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
