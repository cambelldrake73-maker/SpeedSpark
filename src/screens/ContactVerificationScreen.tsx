import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, OtpInput, AuthFlowLogo, ScreenContainer } from '../components';
import { colors, spacing, typography } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../services/supabaseEnv';
import {
  sendContactVerificationCode,
  verifyContactCode,
} from '../services/contactVerification';
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
  const { onboarding, markContactVerified, updateAccount, markLoggedIn, login, syncFromSupabase } =
    useApp();
  const { isSupabaseEnabled, session } = useAuth();
  const isSignup = route.params?.flow !== 'login';
  const useLiveVerification = isSupabaseConfigured;

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
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [delivery, setDelivery] = useState<'sms' | 'call'>('sms');
  const [sendError, setSendError] = useState<string | null>(null);
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);

  const sendCode = useCallback(
    async (nextDelivery: 'sms' | 'call') => {
      if (!useLiveVerification) {
        return;
      }

      setIsSending(true);
      setSendError(null);
      setDevPreviewCode(null);

      try {
        const result = await sendContactVerificationCode({
          method: verification.method,
          destination: verification.destination,
          delivery: verification.method === 'phone' ? nextDelivery : undefined,
        });

        if (!result.ok) {
          setSendError(result.error ?? 'Could not send verification code.');
          return;
        }

        if (result.devPreviewCode) {
          setDevPreviewCode(result.devPreviewCode);
        }
        setDelivery(nextDelivery);
        setSecondsLeft(45);
      } catch (error) {
        setSendError(error instanceof Error ? error.message : 'Could not send verification code.');
      } finally {
        setIsSending(false);
      }
    },
    [useLiveVerification, verification.destination, verification.method],
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (!verification.destination.trim() || !useLiveVerification) {
      return;
    }
    void sendCode('sms');
  }, [verification.method, verification.destination, useLiveVerification, sendCode]);

  const completeVerification = async () => {
    markContactVerified();

    if (!isSignup) {
      if (isSupabaseEnabled && session?.user?.id) {
        const { nextRoute } = await syncFromSupabase(session.user.id);
        navigation.replace(nextRoute === 'Verification' ? 'SpeedDateLobby' : nextRoute);
        return;
      }
      login();
      navigation.replace('SpeedDateLobby');
      return;
    }

    markLoggedIn();
    navigation.replace('ProfileCreation');
  };

  const handleVerify = async () => {
    if (code.replace(/\D/g, '').length < 6) {
      Alert.alert('Enter your code', 'Type the full 6-digit code.');
      return;
    }

    if (!useLiveVerification) {
      void completeVerification();
      return;
    }

    setIsVerifying(true);
    setSendError(null);
    try {
      const result = await verifyContactCode({
        method: verification.method,
        destination: verification.destination,
        code,
        delivery: verification.method === 'phone' ? delivery : undefined,
      });

      if (!result.approved) {
        setSendError(result.error ?? 'Incorrect or expired code.');
        return;
      }

      await completeVerification();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = () => {
    if (secondsLeft > 0 || isSending) return;
    void sendCode(verification.method === 'phone' ? delivery : 'sms');
  };

  const handleCallMe = () => {
    if (isSending || verification.method !== 'phone') return;
    void sendCode('call');
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
    setSendError(null);
    setDevPreviewCode(null);
    setDelivery('sms');
  };

  if (!verification.destination.trim()) {
    return (
      <ScreenContainer scroll={true} scrollToTopOnFocus contentStyle={styles.content}>
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
    <ScreenContainer scroll={true} scrollToTopOnFocus contentStyle={styles.content}>
      <AuthFlowLogo />
      <Pressable style={styles.backRow} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.iconCircle}>
        <Ionicons
          name={
            method === 'phone'
              ? delivery === 'call'
                ? 'call-outline'
                : 'chatbubble-ellipses-outline'
              : 'mail-outline'
          }
          size={32}
          color={colors.sparkOrange}
        />
      </View>

      <Text style={styles.title}>
        {method === 'phone'
          ? delivery === 'call'
            ? 'Enter the code from your call'
            : 'Enter the code we texted you'
          : 'Enter the code we emailed you'}
      </Text>
      <Text style={styles.subtitle}>
        Sent to <Text style={styles.destination}>{maskContact(method, destination)}</Text>
      </Text>

      {isSending ? (
        <View style={styles.sendingRow}>
          <ActivityIndicator color={colors.sparkOrange} />
          <Text style={styles.sendingText}>Sending code…</Text>
        </View>
      ) : null}

      {sendError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={styles.errorText}>{sendError}</Text>
        </View>
      ) : null}

      {!useLiveVerification ? (
        <Text style={styles.demoHint}>Demo mode: enter any 6 digits</Text>
      ) : devPreviewCode ? (
        <Text style={styles.demoHint}>Dev code: {devPreviewCode}</Text>
      ) : null}

      <OtpInput value={code} onChange={setCode} />

      <View style={styles.resendRow}>
        {secondsLeft > 0 ? (
          <Text style={styles.resendMuted}>
            Resend code in 0:{String(secondsLeft).padStart(2, '0')}
          </Text>
        ) : (
          <Pressable onPress={handleResend} disabled={isSending}>
            <Text style={styles.resendLink}>Resend code</Text>
          </Pressable>
        )}
      </View>

      {method === 'phone' && useLiveVerification ? (
        <Pressable style={styles.altAction} onPress={handleCallMe} disabled={isSending}>
          <Text style={styles.altActionText}>Call me with the code instead</Text>
        </Pressable>
      ) : null}

      <Button
        title="Continue"
        onPress={() => void handleVerify()}
        size="lg"
        disabled={!canVerify || isVerifying}
        loading={isVerifying}
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
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sendingText: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    flex: 1,
    lineHeight: 20,
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
