import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface LocalCameraPreviewProps {
  enabled: boolean;
  facing: 'front' | 'back';
  mute?: boolean;
  compact?: boolean;
  label?: string;
}

export function LocalCameraPreview({
  enabled,
  facing,
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

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={styles.cameraStage}>
        <CameraView
          style={styles.camera}
          facing={facing}
          mirror={facing === 'front'}
          mute={mute}
        />
      </View>

      <View style={styles.labelBadge}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web'
      ? ({ objectFit: 'cover', objectPosition: 'center' } as object)
      : null),
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
