import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { colors, spacing, typography } from '../constants/theme';

export const DISTANCE_MIN_MILES = 1;
export const DISTANCE_MAX_MILES = 100;

interface DistanceSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function formatDistanceMiles(miles: number): string {
  if (miles >= DISTANCE_MAX_MILES) return '100+ mi';
  return `${miles} mi`;
}

export function DistanceSlider({ value, onChange }: DistanceSliderProps) {
  const clamped = Math.min(DISTANCE_MAX_MILES, Math.max(DISTANCE_MIN_MILES, Math.round(value)));

  return (
    <View style={styles.wrap}>
      <Text style={styles.value}>{formatDistanceMiles(clamped)}</Text>
      <Slider
        style={styles.slider}
        minimumValue={DISTANCE_MIN_MILES}
        maximumValue={DISTANCE_MAX_MILES}
        step={1}
        value={clamped}
        onValueChange={(next) => onChange(Math.round(next))}
        minimumTrackTintColor={colors.sparkOrange}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.sparkOrange}
      />
      <View style={styles.labels}>
        <Text style={styles.edgeLabel}>1 mi</Text>
        <Text style={styles.edgeLabel}>100+</Text>
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
  slider: {
    width: '100%',
    height: Platform.OS === 'web' ? 28 : 40,
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
