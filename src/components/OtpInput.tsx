import React, { useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../constants/theme';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
}

export function OtpInput({ value, onChange, length = 6 }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.replace(/\D/g, '').slice(0, length);
  const cells = Array.from({ length }, (_, i) => digits[i] ?? '');

  const handleChange = (text: string) => {
    onChange(text.replace(/\D/g, '').slice(0, length));
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.cells} onPress={() => inputRef.current?.focus()}>
        {cells.map((digit, index) => (
          <View
            key={index}
            style={[
              styles.cell,
              digit ? styles.cellFilled : null,
              index === digits.length && digits.length < length ? styles.cellActive : null,
            ]}
          >
            <Text style={styles.cellText}>{digit}</Text>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.hiddenInput}
        showSoftInputOnFocus
        caretHidden
        autoFocus={Platform.OS !== 'web'}
        {...(Platform.OS === 'ios' ? { textContentType: 'oneTimeCode' as const } : {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
    width: '100%',
  },
  hiddenInput: {
    ...(Platform.OS === 'web'
      ? {
          width: '100%',
          marginTop: spacing.sm,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 14,
          ...typography.body,
          color: colors.text,
          textAlign: 'center',
          letterSpacing: 8,
        }
      : {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          opacity: 0.02,
          color: 'transparent',
        }),
  },
  cells: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    width: '100%',
  },
  cell: {
    flex: 1,
    height: 56,
    maxWidth: 52,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: {
    borderColor: colors.sparkOrange,
  },
  cellFilled: {
    borderColor: colors.sparkOrange,
    backgroundColor: colors.surfaceAlt,
  },
  cellText: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
  },
});
