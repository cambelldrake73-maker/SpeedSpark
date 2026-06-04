import { cardShadow } from '../utils/platformStyles';

/** SpeedSpark brand palette — red / orange / gold on dark (matches logo) */
export const colors = {
  /** Core brand */
  sparkRed: '#E61E25',
  sparkOrange: '#F58220',
  sparkGold: '#FFD200',
  /** UI tokens */
  primary: '#E61E25',
  primaryLight: '#F58220',
  primaryDark: '#B9151C',
  accent: '#F58220',
  accentLight: 'rgba(245, 130, 32, 0.15)',
  background: '#0F0F0F',
  surface: '#202020',
  surfaceAlt: '#292929',
  text: '#FFFFFF',
  textSecondary: '#A3A3A3',
  textMuted: '#737373',
  border: '#393939',
  success: '#22C55E',
  successLight: 'rgba(34, 197, 94, 0.15)',
  warning: '#F58220',
  error: '#EF4444',
  overlay: 'rgba(0, 0, 0, 0.72)',
  /** @deprecated */
  secondary: '#F58220',
  secondaryLight: 'rgba(245, 130, 32, 0.15)',
};

export const brand = {
  name: 'SpeedSpark',
  displayName: 'SpeedSpark',
  tagline: 'Queer speed dating, thoughtfully designed',
  logo: require('../../assets/speedspark-logo.png'),
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/** Layout — cap width on large web viewports so content stays readable */
export const layout = {
  maxContentWidth: 960,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  hero: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
};

/** @deprecated Use cardShadow() from utils/platformStyles */
export const shadows = {
  sm: cardShadow('sm'),
  md: cardShadow('md'),
};
