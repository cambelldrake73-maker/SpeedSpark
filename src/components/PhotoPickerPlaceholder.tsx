import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface PhotoPickerPlaceholderProps {
  photos: string[];
  onAddPhoto?: () => void;
  maxPhotos?: number;
}

export function PhotoPickerPlaceholder({
  photos,
  onAddPhoto,
  maxPhotos = 6,
}: PhotoPickerPlaceholderProps) {
  const slots = Array.from({ length: maxPhotos }, (_, i) => photos[i] ?? null);

  return (
    <View style={styles.container}>
      {slots.map((photo, index) => (
        <Pressable
          key={index}
          style={[styles.slot, index === 0 && styles.mainSlot]}
          onPress={onAddPhoto}
        >
          {photo ? (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="image" size={24} color={colors.primaryLight} />
              <Text style={styles.photoText}>Photo {index + 1}</Text>
            </View>
          ) : (
            <View style={styles.emptySlot}>
              <Ionicons name="add" size={28} color={colors.primary} />
              {index === 0 && <Text style={styles.addText}>Main photo</Text>}
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slot: {
    width: '30%',
    aspectRatio: 0.75,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  mainSlot: {
    width: '100%',
    aspectRatio: 1.2,
    borderStyle: 'solid',
    backgroundColor: colors.surfaceAlt,
  },
  emptySlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  addText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  photoText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
