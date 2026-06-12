import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

export type QueueStatus = 'idle' | 'searching';

interface QueueStatusPanelProps {
  status: QueueStatus;
  searchSeconds: number;
  identityVerified: boolean;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
  onVerifyIdentity: () => void;
}

export function QueueStatusPanel({
  status,
  searchSeconds,
  identityVerified,
  onJoinQueue,
  onLeaveQueue,
  onVerifyIdentity,
}: QueueStatusPanelProps) {
  return (
    <View style={styles.panel}>
      {status === 'idle' && !identityVerified && (
        <View style={styles.body}>
          <Button title="Start safety check" onPress={onVerifyIdentity} size="lg" />
        </View>
      )}

      {status === 'idle' && identityVerified && (
        <View style={styles.body}>
          <Button title="Join the queue" onPress={onJoinQueue} size="lg" />
        </View>
      )}

      {status === 'searching' && (
        <View style={styles.body}>
          <ActivityIndicator size="large" color={colors.primary} />
          <View style={styles.timerChip}>
            <Ionicons name="hourglass-outline" size={14} color={colors.primary} />
            <Text style={styles.timerText}>{searchSeconds}s</Text>
          </View>
          <Button title="Leave queue" onPress={onLeaveQueue} variant="outline" size="sm" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
  },
  body: {
    gap: spacing.md,
    alignItems: 'center',
  },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  timerText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
  },
});
