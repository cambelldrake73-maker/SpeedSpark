import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { pickProfilePhotoFromSource, type PhotoSource } from '../utils/pickProfilePhoto';

interface PhotoPickerPlaceholderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export function PhotoPickerPlaceholder({
  photos,
  onPhotosChange,
  maxPhotos = 6,
}: PhotoPickerPlaceholderProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const slots = Array.from({ length: maxPhotos }, (_, i) => photos[i] ?? null);

  const setPhotoAt = (index: number, uri: string) => {
    const next = Array.from({ length: maxPhotos }, (_, i) => photos[i] ?? '');
    next[index] = uri;
    onPhotosChange(next);
  };

  const closePicker = () => {
    if (!loading) setActiveIndex(null);
  };

  const handlePickDirect = async (index: number, source: PhotoSource) => {
    setLoading(true);
    const uri = await pickProfilePhotoFromSource(source);
    setLoading(false);
    setActiveIndex(null);
    if (uri) setPhotoAt(index, uri);
  };

  const handleSourceSelect = (source: PhotoSource) => {
    if (activeIndex === null || loading) return;
    void handlePickDirect(activeIndex, source);
  };

  const handleSlotPress = (index: number) => {
    if (loading) return;
    setActiveIndex(index);
  };

  const slotLabel =
    activeIndex === null
      ? ''
      : activeIndex === 0
        ? 'Main photo'
        : `Photo ${activeIndex + 1}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.container}>
        {slots.map((photo, index) => (
          <Pressable
            key={index}
            style={({ pressed }) => [
              styles.slot,
              activeIndex === index && styles.slotActive,
              pressed && styles.slotPressed,
              Platform.OS === 'web' ? styles.slotWeb : null,
            ]}
            onPress={() => handleSlotPress(index)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={photo ? `Change photo ${index + 1}` : `Add photo ${index + 1}`}
          >
            {photo ? (
              <>
                <Image source={{ uri: photo }} style={styles.photoImage} resizeMode="cover" />
                <View style={styles.photoOverlay} pointerEvents="none">
                  <Ionicons name="camera-outline" size={14} color={colors.text} />
                </View>
              </>
            ) : (
              <View style={styles.emptySlot} pointerEvents="none">
                <Ionicons name="add" size={22} color={colors.sparkOrange} />
                <Text style={styles.addText}>{index === 0 ? 'Main' : `Photo ${index + 1}`}</Text>
              </View>
            )}
            {index === 0 && (
              <View style={styles.mainBadge} pointerEvents="none">
                <Text style={styles.mainBadgeText}>Main</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.sparkOrange} />
          <Text style={styles.loadingText}>Opening…</Text>
        </View>
      )}

      <Modal
        visible={activeIndex !== null && !loading}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closePicker} accessibilityLabel="Close" />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{slotLabel}</Text>
            <Text style={styles.sheetSubtitle}>Choose how to add your photo</Text>

            <Pressable
              style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
              onPress={() => handleSourceSelect('library')}
            >
              <Ionicons name="images-outline" size={22} color={colors.sparkOrange} />
              <Text style={styles.sheetOptionText}>Upload</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
              onPress={() => handleSourceSelect('camera')}
            >
              <Ionicons name="camera-outline" size={22} color={colors.sparkOrange} />
              <Text style={styles.sheetOptionText}>Use camera</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.sheetOptionPressed]}
              onPress={closePicker}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slot: {
    width: '31.5%',
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  slotActive: {
    borderColor: colors.sparkOrange,
    borderStyle: 'solid',
  },
  slotPressed: {
    opacity: 0.85,
  },
  slotWeb: {
    cursor: 'pointer',
  } as object,
  emptySlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  photoImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    padding: 6,
    borderRadius: borderRadius.full,
  },
  mainBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.sparkOrange,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  mainBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
  },
  addText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  sheetTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  sheetSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetOptionPressed: {
    opacity: 0.85,
  },
  sheetOptionText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  sheetCancelText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
