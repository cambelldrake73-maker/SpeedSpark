import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView } from 'expo-camera';
import {
  getBackgroundPreset,
  getBlurPixels,
  type BlurLevel,
  type VirtualBackground,
} from '../constants/cameraEffects';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface LocalCameraPreviewProps {
  enabled: boolean;
  zoom: number;
  facing: 'front' | 'back';
  blurLevel: BlurLevel;
  virtualBackground: VirtualBackground;
  mute?: boolean;
  compact?: boolean;
  label?: string;
}

export function LocalCameraPreview({
  enabled,
  zoom,
  facing,
  blurLevel,
  virtualBackground,
  mute = false,
  compact = false,
  label = 'You',
}: LocalCameraPreviewProps) {
  if (!enabled) {
    return (
      <View style={[styles.container, compact && styles.compact]}>
        <View style={styles.offState}>
          <Ionicons name="videocam-off" size={compact ? 22 : 36} color={colors.textMuted} />
          <Text style={[styles.offLabel, compact && styles.offLabelCompact]}>Camera off</Text>
        </View>
      </View>
    );
  }

  const bgPreset = getBackgroundPreset(virtualBackground);
  const blurPx = getBlurPixels(blurLevel);
  const hasVirtualBg = bgPreset != null;
  const hasBlur = blurLevel !== 'off';

  const cameraWebBlur =
    Platform.OS === 'web' && hasBlur
      ? ({ filter: `blur(${blurPx}px)`, WebkitFilter: `blur(${blurPx}px)` } as object)
      : null;

  const effectLabel = hasBlur
    ? blurLevel === 'strong'
      ? 'Strong blur'
      : 'Soft blur'
    : hasVirtualBg
      ? bgPreset.label
      : null;

  return (
    <View style={[styles.container, compact && styles.compact]}>
      {hasVirtualBg && (
        <LinearGradient
          colors={bgPreset.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.absoluteFill}
        />
      )}

      <View
        style={[
          styles.cameraStage,
          hasVirtualBg && styles.cameraStageWithBg,
          cameraWebBlur,
        ]}
      >
        <CameraView
          style={styles.camera}
          facing={facing}
          zoom={zoom}
          mirror={facing === 'front'}
          mute={mute}
        />
      </View>

      {hasVirtualBg && (
        <View
          style={[
            styles.virtualBgTint,
            { backgroundColor: bgPreset.tint, opacity: bgPreset.tintOpacity },
          ]}
        />
      )}

      {hasBlur && Platform.OS !== 'web' && (
        <View
          style={[
            styles.nativeBlurOverlay,
            blurLevel === 'strong' && styles.nativeBlurOverlayStrong,
          ]}
        />
      )}

      {hasBlur && Platform.OS === 'web' && hasVirtualBg && (
        <View style={styles.webBlurVignette} />
      )}

      <View style={styles.labelBadge}>
        <Text style={styles.labelText}>{label}</Text>
        {effectLabel ? <Text style={styles.effectHint}>{effectLabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  compact: {
    borderRadius: borderRadius.md,
  },
  cameraStage: {
    flex: 1,
    overflow: 'hidden',
  },
  cameraStageWithBg: {
    margin: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  virtualBgTint: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  nativeBlurOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 15, 15, 0.18)',
  },
  nativeBlurOverlayStrong: {
    backgroundColor: 'rgba(15, 15, 15, 0.32)',
  },
  webBlurVignette: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'inset 0 0 80px rgba(0, 0, 0, 0.25)',
        } as object)
      : {}),
  },
  labelBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  labelText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  effectHint: {
    ...typography.caption,
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 1,
  },
  offState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  offLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  offLabelCompact: {
    fontSize: 10,
  },
});

export type { BlurLevel, VirtualBackground };
