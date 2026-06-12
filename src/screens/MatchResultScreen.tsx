import React, { useEffect } from 'react';
import type { MatchResultScreenProps } from '../navigation/types';

/** Legacy route — feedback now returns straight to the queue. */
export function MatchResultScreen({ navigation }: MatchResultScreenProps) {
  useEffect(() => {
    navigation.replace('DateQueue');
  }, [navigation]);

  return null;
}
