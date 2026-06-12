import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { promptOpenAppSettings } from './openAppSettings';

export type PhotoSource = 'library' | 'camera';

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 0.9,
  exif: false,
  ...(Platform.OS === 'ios'
    ? {
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      }
    : {}),
};

function promptPhotoPermissionDenied(source: PhotoSource): void {
  if (source === 'library') {
    promptOpenAppSettings(
      'Photos access needed',
      'Allow photo library access in Settings to upload a picture.',
    );
    return;
  }

  promptOpenAppSettings(
    'Camera access needed',
    'Allow camera access in Settings to take a photo.',
  );
}

export async function pickProfilePhotoFromSource(source: PhotoSource): Promise<string | null> {
  try {
    if (source === 'library') {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          promptPhotoPermissionDenied('library');
          return null;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (result.canceled || !result.assets[0]) return null;
      return result.assets[0].uri;
    }

    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        promptPhotoPermissionDenied('camera');
        return null;
      }
    }

    const result = await ImagePicker.launchCameraAsync(pickerOptions);
    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0].uri;
  } catch {
    Alert.alert('Could not add photo', 'Try again or choose a different image.');
    return null;
  }
}
