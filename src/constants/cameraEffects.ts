export type BlurLevel = 'off' | 'soft' | 'strong';

export type VirtualBackground = 'none' | 'sunset' | 'ocean' | 'midnight' | 'studio' | 'spark';

export interface VirtualBackgroundPreset {
  label: string;
  colors: [string, string, ...string[]];
  tint: string;
  tintOpacity: number;
}

export const BLUR_LEVELS: { value: BlurLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'soft', label: 'Soft' },
  { value: 'strong', label: 'Strong' },
];

export const VIRTUAL_BACKGROUNDS: {
  value: VirtualBackground;
  label: string;
  swatch: string;
  preset: VirtualBackgroundPreset | null;
}[] = [
  { value: 'none', label: 'None', swatch: '#292929', preset: null },
  {
    value: 'sunset',
    label: 'Sunset',
    swatch: '#FF6B35',
    preset: {
      label: 'Sunset',
      colors: ['#FF6B35', '#F58220', '#FFD200'],
      tint: 'rgba(255, 107, 53, 0.28)',
      tintOpacity: 1,
    },
  },
  {
    value: 'ocean',
    label: 'Ocean',
    swatch: '#0EA5E9',
    preset: {
      label: 'Ocean',
      colors: ['#0C4A6E', '#0369A1', '#0EA5E9'],
      tint: 'rgba(14, 165, 233, 0.22)',
      tintOpacity: 1,
    },
  },
  {
    value: 'midnight',
    label: 'Night',
    swatch: '#312E81',
    preset: {
      label: 'Night',
      colors: ['#0F0F0F', '#312E81', '#1E1B4B'],
      tint: 'rgba(49, 46, 129, 0.35)',
      tintOpacity: 1,
    },
  },
  {
    value: 'studio',
    label: 'Studio',
    swatch: '#525252',
    preset: {
      label: 'Studio',
      colors: ['#171717', '#404040', '#737373'],
      tint: 'rgba(64, 64, 64, 0.4)',
      tintOpacity: 1,
    },
  },
  {
    value: 'spark',
    label: 'Spark',
    swatch: '#E61E25',
    preset: {
      label: 'Spark',
      colors: ['#E61E25', '#F58220', '#FFD200'],
      tint: 'rgba(230, 30, 37, 0.2)',
      tintOpacity: 1,
    },
  },
];

export function getBackgroundPreset(value: VirtualBackground): VirtualBackgroundPreset | null {
  return VIRTUAL_BACKGROUNDS.find((bg) => bg.value === value)?.preset ?? null;
}

export function getBlurPixels(level: BlurLevel): number {
  if (level === 'soft') return 6;
  if (level === 'strong') return 14;
  return 0;
}
