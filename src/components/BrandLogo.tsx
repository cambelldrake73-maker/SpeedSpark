import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { brand, colors, spacing } from '../constants/theme';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'auth' | 'lg' | 'hero';
  style?: ViewStyle;
  centered?: boolean;
}

/** Full logo asset includes icon + SpeedSpark wordmark */
const LOGO_HEIGHT: Record<NonNullable<BrandLogoProps['size']>, number> = {
  xs: 28,
  sm: 36,
  md: 50,
  auth: 160,
  lg: 72,
  hero: 228,
};

export function BrandLogo({ size = 'md', style, centered = false }: BrandLogoProps) {
  const height = LOGO_HEIGHT[size];

  return (
    <View style={[styles.wrap, centered && styles.centered, style]}>
      <Image
        source={brand.logo}
        style={{ height, width: height * 1.35 }}
        resizeMode="contain"
        accessibilityLabel="SpeedSpark"
      />
    </View>
  );
}

/** Inline text wordmark when logo image isn't used */
export function BrandWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const fontSize = size === 'sm' ? 17 : size === 'lg' ? 28 : 20;
  return (
    <Text style={[styles.wordmark, { fontSize }]}>
      <Text style={styles.speed}>Speed</Text>
      <Text style={styles.spark}>Spark</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
  centered: {
    alignSelf: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  wordmark: {
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: -0.3,
  },
  speed: {
    color: colors.text,
  },
  spark: {
    color: colors.sparkOrange,
  },
});
