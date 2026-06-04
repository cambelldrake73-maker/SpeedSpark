import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../constants/theme';
import { getPasswordRequirements, passwordsMatch } from '../utils/passwordValidation';

interface PasswordRequirementsProps {
  password: string;
  confirmPassword?: string;
}

export function PasswordRequirements({ password, confirmPassword = '' }: PasswordRequirementsProps) {
  const requirements = getPasswordRequirements(password);
  const showMatch = confirmPassword.length > 0;
  const matchMet = passwordsMatch(password, confirmPassword);

  return (
    <View style={styles.wrap}>
      {requirements.map((req) => (
        <RequirementRow key={req.id} label={req.label} met={req.met} />
      ))}
      {showMatch ? (
        <RequirementRow label="Passwords match" met={matchMet} />
      ) : null}
    </View>
  );
}

function RequirementRow({ label, met }: { label: string; met: boolean }) {
  return (
    <View style={styles.row}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={met ? colors.success : colors.textMuted}
      />
      <Text style={[styles.label, met && styles.labelMet]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  labelMet: {
    color: colors.textSecondary,
  },
});
