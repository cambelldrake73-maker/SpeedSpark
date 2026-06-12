import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { requestDeviceLocation, type ResolvedLocation } from '../utils/deviceLocation';

interface LocationSettingProps {
  value: ResolvedLocation | null;
  onChange: (location: ResolvedLocation) => void;
  error?: string;
}

export function LocationSetting({ value, onChange, error }: LocationSettingProps) {
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleUseLocation = async () => {
    setLoading(true);
    setFetchError(null);

    const result = await requestDeviceLocation();

    setLoading(false);

    if (result.ok) {
      onChange(result.location);
      return;
    }

    setFetchError(result.error);
  };

  const displayError = fetchError ?? error;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, displayError ? styles.labelError : null]}>Location</Text>
      <View style={styles.citySlot}>
        {displayError ? <Text style={styles.error}>{displayError}</Text> : null}
        {value ? <Text style={styles.city}>{value.label}</Text> : null}
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.actionBtn,
          value && !displayError && styles.actionBtnSet,
          displayError && styles.actionBtnError,
          pressed && styles.actionBtnPressed,
        ]}
        onPress={() => void handleUseLocation()}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={value ? 'Update location' : 'Use my location'}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} size="small" />
        ) : (
          <>
            <Ionicons name="navigate-outline" size={18} color={colors.text} />
            <Text style={styles.actionText}>{value ? 'Update location' : 'Use my location'}</Text>
          </>
        )}
      </Pressable>
      <View style={styles.hintSlot}>
        {!displayError ? (
          <Text style={styles.hint}>City level only — set from your device GPS</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  labelError: {
    color: colors.error,
  },
  citySlot: {
    minHeight: 22,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  city: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  hintSlot: {
    minHeight: 18,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnSet: {
    borderColor: colors.sparkOrange,
  },
  actionBtnError: {
    borderColor: colors.error,
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  actionText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    lineHeight: 18,
  },
});
