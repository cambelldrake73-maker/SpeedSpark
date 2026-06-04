import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, OtpInput, ScreenContainer } from '../components';
import { colors, spacing, typography } from '../constants/theme';
import { useApp } from '../context/AppContext';
import type { ContactVerificationMethod } from '../types';
import type { ContactVerificationScreenProps } from '../navigation/types';

function maskContact(method: 'phone' | 'email', value: string): string {
  if (method === 'phone') {
    const digits = value.replace(/\D/g, '');
    const last4 = digits.slice(-4) || '••••';
    return `(•••) •••-${last4}`;
  }
  const [local, domain] = value.split('@');
  if (!domain) return value;
  const masked =
    local.length <= 1 ? '*' : `${local[0]}${'•'.repeat(Math.min(local.length - 1, 4))}`;
  return `${masked}@${domain}`;
}

export function ContactVerificationScreen({ navigation, route }: ContactVerificationScreenProps) {
  const { onboarding, markContactVerified, updateAccount, markLoggedIn } = useApp();
  const isSignup = route.params?.flow !== 'login';

  const verification = useMemo(() => {
    const method: ContactVerificationMethod =
      route.params?.verificationMethod ?? onboarding.account?.verificationMethod ?? 'phone';
    const phone = route.params?.phone ?? onboarding.account?.phone ?? '';
    const email = route.params?.email ?? onboarding.account?.email ?? '';
    const destination = method === 'phone' ? phone : email;
    return { method, phone, email, destination };
  }, [route.params, onboarding.account]);

  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(45);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const handleVerify = () => {
    if (code.replace(/\D/g, '').length < 6) {
      Alert.alert('Enter your code', 'Type the full 6-digit code.');
      return;
    }
    markContactVerified();
    markLoggedIn();
    navigation.replace('ProfileCreation');
  };

  const handleResend = () => {
    if (secondsLeft > 0) return;
    setSecondsLeft(45);
    Alert.alert('Code sent', `A new code was sent to ${maskContact(verification.method, verification.destination)}.`);
  };

  const switchMethod = () => {
    const next: ContactVerificationMethod = verification.method === 'phone' ? 'email' : 'phone';
    if (next === 'email' && !verification.email) {
      Alert.alert('Add an email first', 'Go back and enter an email to verify that way.');
      return;
    }
    if (next === 'phone' && !verification.phone.replace(/\D/g, '')) {
      Alert.alert('Add a phone first', 'Go back and enter a phone number to verify that way.');
      return;
    }
    updateAccount({ verificationMethod: next, contactVerified: false });
    navigation.setParams({ verificationMethod: next });
    setCode('');
    setSecondsLeft(45);
  };

  if (!verification.destination.trim()) {
    return (
      <ScreenContainer scroll contentStyle={styles.content}>
        <Text style={styles.title}>Missing contact info</Text>
        <Text style={styles.subtitle}>
          Go back and enter the {verification.method === 'phone' ? 'phone number' : 'email'} you
          want to verify.
        </Text>
        <Button
          title="Back to sign in"
          onPress={() => navigation.goBack()}
          size="lg"
          style={styles.submitBtn}
        />
      </ScreenContainer>
    );
  }

  const canVerify = code.replace(/\D/g, '').length === 6;
  const { method, destination } = verification;

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <Pressable style={styles.backRow} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.iconCircle}>
        <Ionicons
          name={method === 'phone' ? 'chatbubble-ellipses-outline' : 'mail-outline'}
          size={32}
          color={colors.sparkOrange}
        />
      </View>

      <Text style={styles.title}>
        {method === 'phone' ? 'Enter the code we texted you' : 'Enter the code we emailed you'}
      </Text>
      <Text style={styles.subtitle}>
        Sent to <Text style={styles.destination}>{maskContact(method, destination)}</Text>
      </Text>
      <Text style={styles.demoHint}>Demo: enter any 6 digits</Text>

      <OtpInput value={code} onChange={setCode} />

      <View style={styles.resendRow}>
        {secondsLeft > 0 ? (
          <Text style={styles.resendMuted}>
            Resend code in 0:{String(secondsLeft).padStart(2, '0')}
          </Text>
        ) : (
          <Pressable onPress={handleResend}>
            <Text style={styles.resendLink}>Resend code</Text>
          </Pressable>
        )}
      </View>

      {method === 'phone' && (
        <Pressable style={styles.altAction}>
          <Text style={styles.altActionText}>Call me with the code instead</Text>
        </Pressable>
      )}

      <Button
        title="Continue"
        onPress={handleVerify}
        size="lg"
        disabled={!canVerify}
        style={styles.submitBtn}
      />

      {(verification.phone && verification.email) || isSignup ? (
        <Pressable onPress={switchMethod} style={styles.switchRow}>
          <Text style={styles.switchText}>
            {method === 'phone' ? 'Verify with email instead' : 'Verify with phone instead'}
          </Text>
        </Pressable>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  backText: {
    ...typography.body,
    color: colors.text,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  demoHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  destination: {
    color: colors.text,
    fontWeight: '600',
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resendMuted: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  resendLink: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.sparkOrange,
  },
  altAction: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  altActionText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  submitBtn: {
    marginBottom: spacing.md,
  },
  switchRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  switchText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.sparkOrange,
  },
});
