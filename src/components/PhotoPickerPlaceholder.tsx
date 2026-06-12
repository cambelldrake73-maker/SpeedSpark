import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { cardShadow } from '../utils/platformStyles';
import { pickProfilePhotoFromSource, type PhotoSource } from '../utils/pickProfilePhoto';
import { PhotoCropPreview } from './PhotoCropPreview';

interface PhotoPickerPlaceholderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

interface PendingPreview {
  uri: string;
  index: number;
}

const PHOTO_COLUMNS = 3;
const PHOTO_SLOT_GAP = spacing.sm;
const PHOTO_SLOT_ASPECT = 3 / 4;

export function PhotoPickerPlaceholder({
  photos,
  onPhotosChange,
  maxPhotos = 6,
}: PhotoPickerPlaceholderProps) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);

  const slotWidth =
    gridWidth > 0
      ? (gridWidth - PHOTO_SLOT_GAP * (PHOTO_COLUMNS - 1)) / PHOTO_COLUMNS
      : 0;
  const slotHeight = slotWidth > 0 ? slotWidth / PHOTO_SLOT_ASPECT : 0;

  const handleGridLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0) {
      setGridWidth(width);
    }
  }, []);

  const slots = Array.from({ length: maxPhotos }, (_, i) => photos[i] ?? null);

  const setPhotoAt = (index: number, uri: string) => {
    const next = Array.from({ length: maxPhotos }, (_, i) => photos[i] ?? '');
    next[index] = uri;
    onPhotosChange(next);
  };

  const closeSourcePicker = () => {
    if (!loading) setActiveIndex(null);
  };

  const slotLabel = (index: number) => (index === 0 ? 'Main photo' : `Photo ${index + 1}`);

  const handlePickDirect = async (index: number, source: PhotoSource) => {
    setLoading(true);
    setActiveIndex(null);
    const uri = await pickProfilePhotoFromSource(source);
    setLoading(false);
    if (uri) {
      setPendingPreview({ uri, index });
    }
  };

  const handleSourceSelect = (source: PhotoSource) => {
    if (activeIndex === null || loading) return;
    void handlePickDirect(activeIndex, source);
  };

  const handleSlotPress = (index: number) => {
    if (loading) return;
    setActiveIndex(index);
  };

  const confirmPreview = (croppedUri: string) => {
    if (!pendingPreview) return;
    setPhotoAt(pendingPreview.index, croppedUri);
    setPendingPreview(null);
  };

  const retryPreview = () => {
    if (!pendingPreview) return;
    const index = pendingPreview.index;
    setPendingPreview(null);
    setActiveIndex(index);
  };

  const closePreview = () => {
    setPendingPreview(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.container} onLayout={handleGridLayout}>
        {slots.map((photo, index) => (
          <Pressable
            key={index}
            style={({ pressed }) => [
              styles.slot,
              slotWidth > 0 ? { width: slotWidth, height: slotHeight } : styles.slotSizingFallback,
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
          <Text style={styles.loadingText}>Opening your photos…</Text>
        </View>
      )}

      <Modal
        visible={activeIndex !== null && !loading}
        transparent
        animationType="slide"
        onRequestClose={closeSourcePicker}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeSourcePicker} accessibilityLabel="Close" />
          <View style={[styles.sourceSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {activeIndex === null ? '' : slotLabel(activeIndex)}
            </Text>
            <Text style={styles.sheetSubtitle}>Add a clear photo of you — face visible works best</Text>

            <Pressable
              style={({ pressed }) => [styles.sourceOption, pressed && styles.sourceOptionPressed]}
              onPress={() => handleSourceSelect('library')}
            >
              <View style={styles.sourceIconWrap}>
                <Ionicons name="images-outline" size={22} color={colors.sparkOrange} />
              </View>
              <View style={styles.sourceCopy}>
                <Text style={styles.sourceOptionTitle}>Photo library</Text>
                <Text style={styles.sourceOptionHint}>Choose from your camera roll</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sourceOption, pressed && styles.sourceOptionPressed]}
              onPress={() => handleSourceSelect('camera')}
            >
              <View style={styles.sourceIconWrap}>
                <Ionicons name="camera-outline" size={22} color={colors.sparkOrange} />
              </View>
              <View style={styles.sourceCopy}>
                <Text style={styles.sourceOptionTitle}>Take a photo</Text>
                <Text style={styles.sourceOptionHint}>Use your camera now</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.sourceOptionPressed]}
              onPress={closeSourcePicker}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pendingPreview !== null}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={[styles.previewRoot, { paddingTop: insets.top + spacing.md }]}>
          <Pressable style={styles.backdrop} onPress={closePreview} accessibilityLabel="Close preview" />

          <View style={styles.previewCard}>
            {pendingPreview ? (
              <PhotoCropPreview
                uri={pendingPreview.uri}
                onConfirm={confirmPreview}
                onRetry={retryPreview}
                onCancel={closePreview}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: spacing.md,
  },
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_SLOT_GAP,
    width: '100%',
  },
  slot: {
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  slotSizingFallback: {
    width: '31%',
    aspectRatio: PHOTO_SLOT_ASPECT,
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
    justifyContent: 'flex-end',
  },
  previewRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sourceSheet: {
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    gap: spacing.sm,
    ...cardShadow('md'),
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    ...typography.subtitle,
    color: colors.text,
    textAlign: 'center',
  },
  sheetSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  sourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sourceOptionPressed: {
    opacity: 0.88,
  },
  sourceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentLight,
  },
  sourceCopy: {
    flex: 1,
    minWidth: 0,
  },
  sourceOptionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  sourceOptionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  sheetCancelText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  previewCard: {
    width: '100%',
  },
});
