import { Alert, Linking, Platform } from 'react-native';

export function openAppSettings(): void {
  void Linking.openSettings();
}

export function promptOpenAppSettings(title: string, message: string): void {
  if (Platform.OS === 'web') {
    Alert.alert(title, message);
    return;
  }

  Alert.alert(title, message, [
    { text: 'Not Now', style: 'cancel' },
    { text: 'Open Settings', onPress: openAppSettings },
  ]);
}
