import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { HEIGHT_MAX_INCHES, HEIGHT_MIN_INCHES } from '../constants/options';
import { colors, spacing, typography } from '../constants/theme';
import { formatHeightInches, normalizeHeightInches, normalizeHeightRange } from '../utils/heightFormat';

interface HeightRangeSliderProps {
  minInches: number;
  maxInches: number;
  onChangeMin: (inches: number) => void;
  onChangeMax: (inches: number) => void;
}

export function HeightRangeSlider({
  minInches,
  maxInches,
  onChangeMin,
  onChangeMax,
}: HeightRangeSliderProps) {
  const { min, max } = useMemo(
    () => normalizeHeightRange(minInches, maxInches),
    [minInches, maxInches],
  );

  useEffect(() => {
    if (min !== minInches || max !== maxInches) {
      onChangeMin(min);
      onChangeMax(max);
    }
  }, [min, max, minInches, maxInches, onChangeMin, onChangeMax]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.value}>
        {formatHeightInches(min)} – {formatHeightInches(max)}
      </Text>

      <Text style={styles.sliderLabel}>Shorter end</Text>
      <Slider
        style={styles.slider}
        minimumValue={HEIGHT_MIN_INCHES}
        maximumValue={HEIGHT_MAX_INCHES}
        step={1}
        value={min}
        onValueChange={(next) => onChangeMin(Math.min(normalizeHeightInches(next, min), max))}
        minimumTrackTintColor={colors.sparkOrange}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.sparkOrange}
      />

      <Text style={styles.sliderLabel}>Taller end</Text>
      <Slider
        style={styles.slider}
        minimumValue={HEIGHT_MIN_INCHES}
        maximumValue={HEIGHT_MAX_INCHES}
        step={1}
        value={max}
        onValueChange={(next) => onChangeMax(Math.max(normalizeHeightInches(next, max), min))}
        minimumTrackTintColor={colors.sparkOrange}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.sparkOrange}
      />

      <View style={styles.labels}>
        <Text style={styles.edgeLabel}>{formatHeightInches(HEIGHT_MIN_INCHES)}</Text>
        <Text style={styles.edgeLabel}>{formatHeightInches(HEIGHT_MAX_INCHES)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  value: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sliderLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  slider: {
    width: '100%',
    height: Platform.OS === 'web' ? 28 : 40,
    marginBottom: spacing.sm,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  edgeLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
