import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { cropProfilePhoto } from '../utils/cropProfilePhoto';
import {
  MAX_PHOTO_ZOOM,
  MIN_PHOTO_ZOOM,
  PHOTO_CROP_ASPECT,
  clampPhotoCropTransform,
  computePhotoCropRect,
  getPhotoCropDisplaySize,
  type PhotoCropTransform,
} from '../utils/photoCrop';
import { Button } from './Button';

interface PhotoCropPreviewProps {
  uri: string;
  onConfirm: (uri: string) => void;
  onRetry: () => void;
  onCancel: () => void;
}

type GestureMode = 'none' | 'pan' | 'pinch';

function touchDistance(touches: readonly { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) {
    return 0;
  }
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function PhotoCropPreview({
  uri,
  onConfirm,
  onRetry,
  onCancel,
}: PhotoCropPreviewProps) {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null);
  const [transform, setTransform] = useState<PhotoCropTransform>({
    scale: MIN_PHOTO_ZOOM,
    translateX: 0,
    translateY: 0,
  });
  const [processing, setProcessing] = useState(false);

  const transformRef = useRef(transform);
  transformRef.current = transform;

  const gestureRef = useRef({
    mode: 'none' as GestureMode,
    startScale: MIN_PHOTO_ZOOM,
    startTranslateX: 0,
    startTranslateY: 0,
    startDistance: 0,
  });

  useEffect(() => {
    setTransform({ scale: MIN_PHOTO_ZOOM, translateX: 0, translateY: 0 });
    setImageSize(null);

    Image.getSize(
      uri,
      (width, height) => setImageSize({ width, height }),
      () => setImageSize({ width: 1200, height: 1600 }),
    );
  }, [uri]);

  const applyTransform = useCallback(
    (next: PhotoCropTransform) => {
      if (!frameSize || !imageSize) {
        setTransform(next);
        return;
      }
      setTransform(
        clampPhotoCropTransform(next, frameSize.width, frameSize.height, imageSize.width, imageSize.height),
      );
    },
    [frameSize, imageSize],
  );

  const handleFrameLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setFrameSize({ width, height });
    }
  }, []);

  const displaySize = useMemo(() => {
    if (!frameSize || !imageSize) {
      return null;
    }
    return getPhotoCropDisplaySize(
      frameSize.width,
      frameSize.height,
      imageSize.width,
      imageSize.height,
      transform.scale,
    );
  }, [frameSize, imageSize, transform.scale]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const touches = event.nativeEvent.touches;
        if (touches.length >= 2) {
          gestureRef.current = {
            mode: 'pinch',
            startScale: transformRef.current.scale,
            startTranslateX: transformRef.current.translateX,
            startTranslateY: transformRef.current.translateY,
            startDistance: touchDistance(touches),
          };
          return;
        }

        gestureRef.current = {
          mode: 'pan',
          startScale: transformRef.current.scale,
          startTranslateX: transformRef.current.translateX,
          startTranslateY: transformRef.current.translateY,
          startDistance: 0,
        };
      },
      onPanResponderMove: (event, gestureState) => {
        const touches = event.nativeEvent.touches;
        const current = transformRef.current;

        if (touches.length >= 2) {
          const distance = touchDistance(touches);
          if (distance <= 0) {
            return;
          }

          if (gestureRef.current.mode !== 'pinch') {
            gestureRef.current = {
              mode: 'pinch',
              startScale: current.scale,
              startTranslateX: current.translateX,
              startTranslateY: current.translateY,
              startDistance: distance,
            };
          }

          const nextScale =
            gestureRef.current.startScale * (distance / Math.max(gestureRef.current.startDistance, 1));

          applyTransform({
            scale: nextScale,
            translateX: gestureRef.current.startTranslateX,
            translateY: gestureRef.current.startTranslateY,
          });
          return;
        }

        if (gestureRef.current.mode === 'pan') {
          applyTransform({
            scale: current.scale,
            translateX: gestureRef.current.startTranslateX + gestureState.dx,
            translateY: gestureRef.current.startTranslateY + gestureState.dy,
          });
        }
      },
      onPanResponderRelease: () => {
        gestureRef.current.mode = 'none';
      },
      onPanResponderTerminate: () => {
        gestureRef.current.mode = 'none';
      },
    }),
  ).current;

  const handleZoomSlider = useCallback(
    (value: number) => {
      applyTransform({
        ...transformRef.current,
        scale: value,
      });
    },
    [applyTransform],
  );

  const handleConfirm = async () => {
    if (!frameSize || !imageSize || processing) {
      return;
    }

    setProcessing(true);
    try {
      const crop = computePhotoCropRect({
        frameWidth: frameSize.width,
        frameHeight: frameSize.height,
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        transform: transformRef.current,
      });

      const croppedUri = await cropProfilePhoto(uri, crop);
      onConfirm(croppedUri);
    } finally {
      setProcessing(false);
    }
  };

  const imageStyle =
    displaySize && frameSize
      ? {
          width: displaySize.width,
          height: displaySize.height,
          left: (frameSize.width - displaySize.width) / 2 + transform.translateX,
          top: (frameSize.height - displaySize.height) / 2 + transform.translateY,
        }
      : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Frame your photo</Text>
      </View>

      <View style={styles.frameOuter}>
        <LinearGradient
          colors={[colors.sparkOrange, colors.sparkRed, colors.sparkGold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.frameBorder}
        >
          <View style={styles.frameInner} onLayout={handleFrameLayout} {...panResponder.panHandlers}>
            {!imageSize || !imageStyle ? (
              <View style={styles.frameLoading}>
                <ActivityIndicator color={colors.sparkOrange} />
              </View>
            ) : (
              <Image source={{ uri }} style={[styles.image, imageStyle]} resizeMode="cover" />
            )}
            <View style={styles.frameHint} pointerEvents="none">
              <Text style={styles.frameHintText}>Drag to move</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.zoomRow}>
        <Ionicons name="remove-outline" size={18} color={colors.textMuted} />
        <Slider
          style={styles.zoomSlider}
          minimumValue={MIN_PHOTO_ZOOM}
          maximumValue={MAX_PHOTO_ZOOM}
          value={transform.scale}
          onValueChange={handleZoomSlider}
          minimumTrackTintColor={colors.sparkOrange}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.sparkOrange}
          disabled={!imageSize}
        />
        <Ionicons name="add-outline" size={18} color={colors.textMuted} />
      </View>
      <Text style={styles.zoomLabel}>Zoom</Text>

      <View style={styles.actions}>
        <Button title="Use this photo" onPress={() => void handleConfirm()} size="lg" loading={processing} />
        <Button title="Choose another" onPress={onRetry} variant="outline" size="md" disabled={processing} />
        <Pressable
          style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
          onPress={onCancel}
          disabled={processing}
        >
          <Text style={styles.dismissText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  header: {
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  frameOuter: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 280,
  },
  frameBorder: {
    borderRadius: borderRadius.lg + 2,
    padding: 2,
  },
  frameInner: {
    aspectRatio: PHOTO_CROP_ASPECT,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  frameLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    position: 'absolute',
  },
  frameHint: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    alignItems: 'center',
  },
  frameHintText: {
    ...typography.caption,
    color: colors.text,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  zoomSlider: {
    flex: 1,
    height: Platform.OS === 'ios' ? 32 : 40,
  },
  zoomLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dismiss: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dismissPressed: {
    opacity: 0.88,
  },
  dismissText: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
