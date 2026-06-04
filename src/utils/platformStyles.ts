import { Platform, ViewStyle } from 'react-native';

/** Cross-platform card shadow */
export function cardShadow(intensity: 'sm' | 'md' = 'md'): ViewStyle {
  if (Platform.OS === 'web') {
    return intensity === 'sm'
      ? { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)' }
      : { boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04)' };
  }
  return intensity === 'sm'
    ? {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }
    : {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
      };
}
