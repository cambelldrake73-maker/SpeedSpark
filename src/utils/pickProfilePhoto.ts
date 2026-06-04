import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PhotoSource = 'library' | 'camera';

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [3, 4],
  quality: 0.85,
};

export async function pickProfilePhotoFromSource(source: PhotoSource): Promise<string | null> {
  try {
    if (source === 'library') {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Photos access needed',
            'Allow photo library access in settings to upload a picture.',
          );
          return null;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (result.canceled || !result.assets[0]) return null;
      return result.assets[0].uri;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow camera access in settings to take a photo.',
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync(pickerOptions);
    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0].uri;
  } catch {
    Alert.alert('Could not add photo', 'Try again or choose a different image.');
    return null;
  }
}
