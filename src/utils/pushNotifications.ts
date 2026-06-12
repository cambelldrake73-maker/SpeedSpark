import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { openAppSettings } from './openAppSettings';

export type PushPermissionStatus = 'unavailable' | 'undetermined' | 'granted' | 'denied';

type NotificationsModule = typeof import('expo-notifications');

type ExpoDeviceNative = {
  isDevice?: boolean;
};

function mapPermissionStatus(status: string | undefined): PushPermissionStatus {
  if (status === 'granted') {
    return 'granted';
  }
  if (status === 'denied') {
    return 'denied';
  }
  return 'undetermined';
}

function resolveNotificationsModule(mod: unknown): NotificationsModule | null {
  if (!mod || typeof mod !== 'object') {
    return null;
  }

  const candidate = mod as NotificationsModule & { default?: NotificationsModule };
  if (typeof candidate.getPermissionsAsync === 'function') {
    return candidate;
  }
  if (candidate.default && typeof candidate.default.getPermissionsAsync === 'function') {
    return candidate.default;
  }

  return null;
}

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (!canUsePushNotifications()) {
    return null;
  }

  try {
    const mod = await import('expo-notifications');
    return resolveNotificationsModule(mod);
  } catch (error) {
    console.warn('[SpeedSpark] expo-notifications unavailable', error);
    return null;
  }
}

function readIsPhysicalDevice(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }

  const ExpoDevice = requireOptionalNativeModule<ExpoDeviceNative>('ExpoDevice');
  if (!ExpoDevice || typeof ExpoDevice.isDevice !== 'boolean') {
    // Dev client built before expo-device was linked — treat as unsupported.
    return false;
  }

  return ExpoDevice.isDevice;
}

/** Native iOS/Android — includes simulator (permission UI only). */
export function isPushPlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Push APIs are only safe on a physical device with remote notification support. */
export function canUsePushNotifications(): boolean {
  return isPushPlatform() && readIsPhysicalDevice();
}

/** @deprecated Prefer canUsePushNotifications for permission flows. */
export function isNativePushAvailable(): boolean {
  return canUsePushNotifications();
}

export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (!canUsePushNotifications()) {
    return 'unavailable';
  }

  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return 'unavailable';
    }
    const settings = await Notifications.getPermissionsAsync();
    return mapPermissionStatus(settings.status);
  } catch (error) {
    console.warn('[SpeedSpark] Could not read push permission status', error);
    return 'unavailable';
  }
}

/** Triggers the system permission dialog (iOS Allow / Don't Allow). */
export async function requestPushPermission(): Promise<PushPermissionStatus> {
  if (!canUsePushNotifications()) {
    return 'unavailable';
  }

  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return 'unavailable';
    }
    const settings = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    return mapPermissionStatus(settings.status);
  } catch (error) {
    console.warn('[SpeedSpark] Push permission request failed', error);
    return 'unavailable';
  }
}

export function openAppNotificationSettings(): void {
  openAppSettings();
}

export function pushPermissionStatusLabel(
  status: PushPermissionStatus,
  options?: { onSimulator?: boolean },
): string {
  if (options?.onSimulator) {
    return 'Physical device only';
  }

  switch (status) {
    case 'granted':
      return 'On';
    case 'denied':
      return 'Off';
    case 'undetermined':
      return 'Tap to enable';
    default:
      return 'Unavailable';
  }
}

/** True when push is unavailable on iOS (simulator or dev client without native push). */
export function isIosSimulator(): boolean {
  return Platform.OS === 'ios' && !readIsPhysicalDevice();
}

export function isPushUnavailableOnDevice(): boolean {
  return isPushPlatform() && !canUsePushNotifications();
}
