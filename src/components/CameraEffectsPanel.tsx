import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BLUR_LEVELS,
  VIRTUAL_BACKGROUNDS,
  type BlurLevel,
  type VirtualBackground,
} from '../constants/cameraEffects';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface CameraEffectsPanelProps {
  blurLevel: BlurLevel;
  virtualBackground: VirtualBackground;
  onBlurChange: (level: BlurLevel) => void;
  onBackgroundChange: (background: VirtualBackground) => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFlip: () => void;
  onClose: () => void;
  zoomOutDisabled?: boolean;
  zoomInDisabled?: boolean;
}

export function CameraEffectsPanel({
  blurLevel,
  virtualBackground,
  onBlurChange,
  onBackgroundChange,
  onZoomOut,
  onZoomIn,
  onFlip,
  onClose,
  zoomOutDisabled,
  zoomInDisabled,
}: CameraEffectsPanelProps) {
  const selectedBg = VIRTUAL_BACKGROUNDS.find((bg) => bg.value === virtualBackground);

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>Effects</Text>
        <Text style={styles.subtitle}>
          {selectedBg?.label ?? 'None'} · {BLUR_LEVELS.find((b) => b.value === blurLevel)?.label ?? 'Off'}
        </Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8} accessibilityLabel="Close effects">
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.controlsRow}>
        <View style={styles.toolGroup}>
          <IconButton icon="remove" onPress={onZoomOut} disabled={zoomOutDisabled} label="Zoom out" />
          <IconButton icon="add" onPress={onZoomIn} disabled={zoomInDisabled} label="Zoom in" />
          <IconButton icon="camera-reverse-outline" onPress={onFlip} label="Flip camera" />
        </View>

        <View style={styles.divider} />

        <View style={styles.segmentGroup}>
          {BLUR_LEVELS.map((level) => (
            <Pressable
              key={level.value}
              onPress={() => onBlurChange(level.value)}
              style={[styles.segment, blurLevel === level.value && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, blurLevel === level.value && styles.segmentTextActive]}>
                {level.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bgRow}
      >
        {VIRTUAL_BACKGROUNDS.map((bg) => {
          const selected = virtualBackground === bg.value;
          return (
            <Pressable
              key={bg.value}
              onPress={() => onBackgroundChange(bg.value)}
              style={[styles.bgItem, selected && styles.bgItemSelected]}
              accessibilityLabel={`Background ${bg.label}`}
            >
              <View style={[styles.bgDot, { backgroundColor: bg.swatch }, selected && styles.bgDotSelected]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function IconButton({
  icon,
  onPress,
  disabled,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.iconBtn,
        disabled && styles.iconBtnDisabled,
        pressed && !disabled && styles.iconBtnPressed,
      ]}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={disabled ? colors.textMuted : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    backgroundColor: 'rgba(18, 18, 18, 0.94)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)' } as object)
      : {}),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingRight: 28,
  },
  title: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.sm,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  toolGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  iconBtnDisabled: {
    opacity: 0.35,
  },
  iconBtnPressed: {
    opacity: 0.8,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  segmentGroup: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: borderRadius.full,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  segmentActive: {
    backgroundColor: colors.sparkOrange,
  },
  segmentText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.text,
  },
  bgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  bgItem: {
    padding: 2,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bgItemSelected: {
    borderColor: colors.sparkOrange,
  },
  bgDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  bgDotSelected: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
});
