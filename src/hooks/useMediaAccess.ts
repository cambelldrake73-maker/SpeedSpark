import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { openAppSettings, promptOpenAppSettings } from '../utils/openAppSettings';

type MediaAccessState = {
  granted: boolean;
  pending: boolean;
  denied: boolean;
  errorMessage: string | null;
  requestAccess: () => Promise<void>;
  openSettings: () => void;
};

/**
 * Web browsers block camera/mic until a user gesture. Native can prompt on mount.
 */
export function useMediaAccess(): MediaAccessState {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [webGranted, setWebGranted] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const nativeGranted =
    cameraPermission?.granted === true && micPermission?.granted === true;
  const nativePending = cameraPermission == null || micPermission == null;

  const granted = Platform.OS === 'web' ? webGranted : nativeGranted;
  const pending = Platform.OS === 'web' ? requesting : nativePending;
  const denied =
    Platform.OS === 'web'
      ? !webGranted && webError != null
      : !nativePending && !nativeGranted;

  const promptMediaSettings = useCallback(() => {
    promptOpenAppSettings(
      'Camera & microphone needed',
      'Allow camera and microphone access in Settings for your date.',
    );
  }, []);

  const requestWebAccess = useCallback(async () => {
    setRequesting(true);
    setWebError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setWebError('Camera and microphone are not supported in this browser.');
      setRequesting(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      stream.getTracks().forEach((track) => track.stop());
      setWebGranted(true);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setWebError('Permission blocked. Check the camera icon in your browser address bar.');
      } else if (name === 'NotFoundError') {
        setWebError('No camera or microphone found on this device.');
      } else {
        setWebError('Could not access camera or microphone. Try again.');
      }
      setWebGranted(false);
    } finally {
      setRequesting(false);
    }
  }, []);

  const requestNativeAccess = useCallback(async (promptSettingsOnDeny = false) => {
    setRequesting(true);
    try {
      const cam = await requestCameraPermission();
      const mic = await requestMicPermission();

      if (promptSettingsOnDeny && (cam?.granted !== true || mic?.granted !== true)) {
        promptMediaSettings();
      }
    } finally {
      setRequesting(false);
    }
  }, [promptMediaSettings, requestCameraPermission, requestMicPermission]);

  const requestAccess = useCallback(async () => {
    if (Platform.OS === 'web') {
      await requestWebAccess();
      return;
    }
    await requestNativeAccess(true);
  }, [requestNativeAccess, requestWebAccess]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      void requestNativeAccess(false);
    }
  }, [requestNativeAccess]);

  return {
    granted,
    pending,
    denied,
    errorMessage: webError,
    requestAccess,
    openSettings: openAppSettings,
  };
}
