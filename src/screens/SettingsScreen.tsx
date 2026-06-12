import React, { useCallback, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Button, ScreenContainer, SettingsRow, SettingsSection } from '../components';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatAuthErrorForUser } from '../utils/authErrors';
import {
  canUsePushNotifications,
  getPushPermissionStatus,
  isPushUnavailableOnDevice,
  isPushPlatform,
  openAppNotificationSettings,
  pushPermissionStatusLabel,
  requestPushPermission,
  type PushPermissionStatus,
} from '../utils/pushNotifications';
import type { SettingsScreenProps } from '../navigation/types';

const pushPlatform = isPushPlatform();

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { currentUser, logout, deleteAccount, blockedUsers } = useApp();
  const { isSupabaseEnabled, signOut } = useAuth();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushPermissionStatus>('undetermined');

  const refreshPushStatus = useCallback(async () => {
    if (!canUsePushNotifications()) {
      return;
    }
    setPushStatus(await getPushPermissionStatus());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPushStatus();
    }, [refreshPushStatus]),
  );

  const promptOpenSettings = () => {
    Alert.alert(
      'Turn on notifications',
      Platform.OS === 'ios'
        ? 'Notifications are off for SpeedSpark. You can turn them on in Settings.'
        : 'Notifications are off for SpeedSpark. You can turn them on in your device settings.',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Open Settings', onPress: openAppNotificationSettings },
      ],
    );
  };

  const handleEnableNotifications = async () => {
    if (!canUsePushNotifications()) {
      return;
    }

    const currentStatus = await getPushPermissionStatus();
    setPushStatus(currentStatus);

    if (currentStatus === 'unavailable') {
      promptOpenSettings();
      return;
    }

    if (currentStatus === 'undetermined') {
      const nextStatus = await requestPushPermission();
      setPushStatus(nextStatus);
      if (nextStatus === 'denied') {
        promptOpenSettings();
      }
      return;
    }

    if (currentStatus === 'denied') {
      promptOpenSettings();
      return;
    }

    Alert.alert(
      'Notifications enabled',
      'To change alert types, open your device notification settings.',
      [
        { text: 'OK', style: 'cancel' },
        { text: 'Open Settings', onPress: openAppNotificationSettings },
      ],
    );
  };

  const handleSignOut = () => {
    setShowSignOutConfirm(true);
  };

  const confirmSignOut = async () => {
    setShowSignOutConfirm(false);
    if (isSupabaseEnabled) {
      await signOut();
    }
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      await deleteAccount();
      if (isSupabaseEnabled) {
        await signOut();
      }
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    } catch (error) {
      Alert.alert('Could not delete account', formatAuthErrorForUser(error));
    }
  };

  return (
    <>
    <ScreenContainer scroll={true} contentStyle={styles.content}>
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
          subtitle="Age, distance, height, and more"
          onPress={() => navigation.navigate('Preferences', { fromSettings: true })}
          last
        />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <SettingsRow
          icon="notifications-outline"
          title="Enable notifications"
          compact
          value={
            pushPlatform
              ? pushPermissionStatusLabel(pushStatus, {
                  onSimulator: isPushUnavailableOnDevice(),
                })
              : undefined
          }
          onPress={canUsePushNotifications() ? () => void handleEnableNotifications() : undefined}
          showChevron={canUsePushNotifications()}
          last
        />
      </SettingsSection>

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
        visible={showSignOutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutConfirm(false)}
      >
        <Pressable
          style={styles.confirmOverlay}
          onPress={() => setShowSignOutConfirm(false)}
          accessibilityLabel="Dismiss sign out confirmation"
        >
          <Pressable style={styles.confirmCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.confirmTitle}>Sign out?</Text>
            <Text style={styles.confirmText}>
              You can sign back in anytime with your phone or email.
            </Text>
            <View style={styles.confirmActions}>
              <Button
                title="Cancel"
                onPress={() => setShowSignOutConfirm(false)}
                variant="outline"
                size="sm"
              />
              <Button title="Sign out" onPress={() => void confirmSignOut()} size="sm" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <Pressable
          style={styles.confirmOverlay}
          onPress={() => setShowDeleteConfirm(false)}
          accessibilityLabel="Dismiss delete confirmation"
        >
          <Pressable style={styles.confirmCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.confirmTitle}>Delete your account?</Text>
            <Text style={styles.confirmText}>
              Your profile, matches, and messages will be permanently removed.
            </Text>
            <View style={styles.confirmActions}>
              <Button
                title="Cancel"
                onPress={() => setShowDeleteConfirm(false)}
                variant="outline"
                size="sm"
              />
              <Button title="Delete" onPress={confirmDelete} size="sm" />
            </View>
          </Pressable>
        </Pressable>
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
  confirmOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  confirmText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
