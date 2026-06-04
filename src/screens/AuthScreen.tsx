import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandLogo, Button, Input, PasswordRequirements, ScreenContainer, SelectableOption } from '../components';
import { SIGNUP_AGREEMENT_POINTS } from '../constants/legalContent';
import { borderRadius, colors, spacing, typography } from '../constants/theme';
import { logAndFormatAuthError, logAuthDebug } from '../utils/authErrors';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { runSupabaseConnectionTest } from '../services/supabaseHealth';
import { formatPhoneInput, phoneDigits } from '../utils/formatPhone';
import { passwordMeetsRequirements, passwordsMatch } from '../utils/passwordValidation';
import type { ContactVerificationMethod } from '../types';
import type { AuthScreenProps } from '../navigation/types';

type AuthMode = 'signup' | 'login';
type LoginMethod = 'phone' | 'email';

export function AuthScreen({ navigation, route }: AuthScreenProps) {
  const { login, markLoggedIn, updateProfile, updateAccount, isOnboarded, syncFromSupabase } =
    useApp();
  const { isSupabaseEnabled, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>(route.params?.initialMode ?? 'login');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(
    isSupabaseEnabled ? 'email' : 'phone',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<ContactVerificationMethod>(
    isSupabaseEnabled ? 'email' : 'phone',
  );
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [connectionTestSummary, setConnectionTestSummary] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const showAuthError = (error: unknown, operation?: string, alertTitle = 'Something went wrong') => {
    const message = logAndFormatAuthError(operation ?? 'AuthScreen', error);
    setAuthError(message);
    logAuthDebug('UI error', { operation, message });
    Alert.alert(alertTitle, message);
  };

  useEffect(() => {
    logAuthDebug('Cloud auth enabled on Auth screen', isSupabaseEnabled);
    if (isSupabaseEnabled) {
      setLoginMethod('email');
      setVerificationMethod('email');
    }
  }, [isSupabaseEnabled]);

  useEffect(() => {
    setAuthError(null);
  }, [mode, loginMethod, verificationMethod]);

  useEffect(() => {
    if (route.params?.initialMode) {
      setMode(route.params.initialMode);
    }
  }, [route.params?.initialMode]);

  const signupReady = useMemo(() => {
    const ageNum = parseInt(age, 10);
    const hasName = firstName.trim().length > 0 && lastName.trim().length > 0;
    const hasAge = ageNum >= 18;
    const hasValidPassword =
      passwordMeetsRequirements(password) && passwordsMatch(password, confirmPassword);
    const hasEmail = email.trim().includes('@');

    if (isSupabaseEnabled) {
      return hasName && hasAge && hasValidPassword && hasEmail && agreedToTerms;
    }

    if (verificationMethod === 'phone') {
      return hasName && hasAge && hasValidPassword && phoneDigits(phone).length >= 10 && agreedToTerms;
    }
    return hasName && hasAge && hasValidPassword && hasEmail && agreedToTerms;
  }, [
    firstName,
    lastName,
    age,
    phone,
    email,
    password,
    confirmPassword,
    verificationMethod,
    agreedToTerms,
    isSupabaseEnabled,
  ]);

  const confirmPasswordError =
    confirmPassword.length > 0 && !passwordsMatch(password, confirmPassword)
      ? 'Passwords do not match'
      : undefined;

  const loginReady = useMemo(() => {
    if (loginMethod === 'phone') {
      return phoneDigits(phone).length >= 10;
    }
    return email.trim().includes('@') && password.length > 0;
  }, [loginMethod, phone, email, password]);

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhoneInput(value));
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionTestSummary(null);
    try {
      const result = await runSupabaseConnectionTest();
      setConnectionTestSummary(result.summary);
      Alert.alert('Connection test', result.summary);
    } catch (error) {
      const message = logAndFormatAuthError('AuthScreen.connectionTest', error);
      setConnectionTestSummary(message);
      Alert.alert('Connection test', message);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleLogin = async () => {
    setAuthError(null);

    if (isSupabaseEnabled && loginMethod === 'phone') {
      showAuthError(
        { message: 'Phone login is not available yet. Use email and your password.' },
        'AuthScreen.login',
        'Log in',
      );
      return;
    }

    if (loginMethod === 'phone') {
      if (phoneDigits(phone).length < 10) {
        Alert.alert('Phone required', 'Enter the number you signed up with.');
        return;
      }
      updateAccount({
        firstName: '',
        lastName: '',
        age: 0,
        phone: phone.trim(),
        email: '',
        verificationMethod: 'phone',
        contactVerified: false,
      });
      navigation.navigate('ContactVerification', {
        flow: 'login',
        phone: phone.trim(),
        verificationMethod: 'phone',
      });
      return;
    }

    if (!email.trim()) {
      Alert.alert('Email required', 'Enter your email to log in.');
      return;
    }

    if (!password) {
      Alert.alert('Password required', 'Enter your password.');
      return;
    }

    if (isSupabaseEnabled) {
      setIsSubmitting(true);
      try {
        const session = await signIn({ email: email.trim(), password });
        const onboarded = await syncFromSupabase(session.user.id);
        navigation.replace(onboarded ? 'SpeedDateLobby' : 'ProfileCreation');
      } catch (error) {
        showAuthError(error, 'AuthScreen.login', 'Log in failed');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    logAuthDebug('Demo login (no Supabase env)');
    if (isOnboarded) {
      login();
      navigation.replace('SpeedDateLobby');
    } else {
      markLoggedIn();
      navigation.replace('ProfileCreation');
    }
  };

  const handleSignup = async () => {
    if (!signupReady) return;
    setAuthError(null);

    const ageNum = parseInt(age, 10);
    const displayName = `${firstName.trim()} ${lastName.trim()}`;

    updateAccount({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      age: ageNum,
      phone: phone.trim(),
      email: email.trim(),
      verificationMethod,
      contactVerified: false,
    });
    updateProfile({ name: displayName, age: ageNum });

    if (isSupabaseEnabled) {
      if (!email.trim().includes('@')) {
        showAuthError(
          { message: 'A valid email is required to create an account.' },
          'AuthScreen.signUp',
          'Sign up',
        );
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await signUp({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          age: ageNum,
        });

        updateProfile({ id: result.user.id, name: displayName, age: ageNum });

        if (result.needsEmailConfirmation) {
          const message =
            'Account created. Check your email to confirm your address, then log in with Email.';
          setAuthError(message);
          logAuthDebug('UI info', message);
          Alert.alert('Confirm your email', message);
          setMode('login');
          setLoginMethod('email');
          return;
        }

        markLoggedIn();
        try {
          const onboarded = await syncFromSupabase(result.user.id);
          navigation.replace(onboarded ? 'SpeedDateLobby' : 'ProfileCreation');
        } catch (syncError) {
          showAuthError(syncError, 'AuthScreen.syncAfterSignUp', 'Could not load profile');
        }
      } catch (error) {
        showAuthError(error, 'AuthScreen.signUp', 'Sign up failed');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    logAuthDebug('Demo signup (no Supabase env)');
    navigation.navigate('ContactVerification', {
      flow: 'signup',
      phone: phone.trim(),
      email: email.trim(),
      verificationMethod,
    });
  };

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <View style={styles.logoHeader}>
        <BrandLogo size="auth" />
      </View>

      <View style={styles.modeTabs}>
        <Pressable
          style={[styles.modeTab, mode === 'signup' && styles.modeTabActive]}
          onPress={() => setMode('signup')}
        >
          <Text style={[styles.modeTabText, mode === 'signup' && styles.modeTabTextActive]}>
            Sign up
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}
          onPress={() => setMode('login')}
        >
          <Text style={[styles.modeTabText, mode === 'login' && styles.modeTabTextActive]}>
            Log in
          </Text>
        </Pressable>
      </View>

      {__DEV__ && isSupabaseEnabled ? (
        <View style={styles.devTools}>
          <Button
            title="Test connection (dev)"
            onPress={handleTestConnection}
            size="sm"
            loading={isTestingConnection}
            disabled={isTestingConnection}
          />
          {connectionTestSummary ? (
            <Text style={styles.devToolsText} selectable>
              {connectionTestSummary}
            </Text>
          ) : null}
        </View>
      ) : null}

      {authError ? (
        <View style={styles.authErrorBanner} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={20} color={colors.error} />
          <Text style={styles.authErrorText}>{authError}</Text>
        </View>
      ) : null}

      {mode === 'signup' ? (
        <>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            {isSupabaseEnabled
              ? 'Create an account with your email and password. Phone verification codes are demo-only until SMS is wired up.'
              : 'Real name and age help keep the community safe. Your number or email is only used to verify you — never shown on your profile.'}
          </Text>

          <Text style={styles.sectionLabel}>Your name</Text>
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Input
                label="First name"
                placeholder="Alex"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.nameField}>
              <Input
                label="Last name"
                placeholder="Rivera"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <Input
            label="Age"
            placeholder="25"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            hint="You must be 18 or older"
          />

          <Text style={styles.sectionLabel}>How should we verify you?</Text>
          {!isSupabaseEnabled ? (
            <>
              <SelectableOption
                selected={verificationMethod === 'phone'}
                onPress={() => setVerificationMethod('phone')}
                icon="chatbubble-ellipses-outline"
                title="Text message"
                description="We'll send a 6-digit code to your phone"
              />
              <SelectableOption
                selected={verificationMethod === 'email'}
                onPress={() => setVerificationMethod('email')}
                icon="mail-outline"
                title="Email"
                description="We'll send a 6-digit code to your inbox"
              />
            </>
          ) : (
            <Text style={styles.demoNote}>
              Your account uses email and password. Optional contact info below is for your profile only.
            </Text>
          )}

          {verificationMethod === 'phone' && !isSupabaseEnabled ? (
            <>
              <Text style={styles.sectionLabel}>Mobile number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>+1</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="(555) 555-0100"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={14}
                />
              </View>
              <Input
                label={isSupabaseEnabled ? 'Email (required for account)' : 'Email (optional)'}
                placeholder="For account recovery"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </>
          ) : (
            <>
              <Input
                label={isSupabaseEnabled ? 'Email (required for account)' : 'Email'}
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.sectionLabel}>Mobile number (optional)</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>+1</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="(555) 555-0100"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={14}
                />
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>Password</Text>
          <Input
            label="Create a password"
            placeholder="Create a strong password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <PasswordRequirements password={password} confirmPassword={confirmPassword} />
          <Input
            label="Confirm password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            error={confirmPasswordError}
          />

          <View style={styles.agreementCard}>
            <Pressable
              style={styles.agreementRow}
              onPress={() => setAgreedToTerms((value) => !value)}
            >
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms ? <Ionicons name="checkmark" size={14} color={colors.text} /> : null}
              </View>
              <Text style={styles.agreementText}>
                I confirm I'm 18+ and agree to the{' '}
                <Text
                  style={styles.link}
                  onPress={() => navigation.navigate('LegalDocument', { documentId: 'terms' })}
                >
                  Terms of Service
                </Text>
                ,{' '}
                <Text
                  style={styles.link}
                  onPress={() => navigation.navigate('LegalDocument', { documentId: 'privacy' })}
                >
                  Privacy Policy
                </Text>
                , and{' '}
                <Text
                  style={styles.link}
                  onPress={() => navigation.navigate('LegalDocument', { documentId: 'community' })}
                >
                  Community Guidelines
                </Text>
                .
              </Text>
            </Pressable>

            {SIGNUP_AGREEMENT_POINTS.map((point) => (
              <View key={point} style={styles.agreementPoint}>
                <Text style={styles.agreementBullet}>·</Text>
                <Text style={styles.agreementPointText}>{point}</Text>
              </View>
            ))}
          </View>

          <Button
            title="Continue"
            onPress={handleSignup}
            size="lg"
            disabled={!signupReady || isSubmitting}
            loading={isSubmitting}
            style={styles.submitBtn}
          />
        </>
      ) : (
        <>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            {isSupabaseEnabled
              ? 'Log in with the email and password you used when you signed up.'
              : 'Log in the same way you signed up.'}
          </Text>

          <View style={styles.loginMethodRow}>
            {!isSupabaseEnabled ? (
              <Pressable
                style={[styles.loginChip, loginMethod === 'phone' && styles.loginChipActive]}
                onPress={() => setLoginMethod('phone')}
              >
                <Text
                  style={[styles.loginChipText, loginMethod === 'phone' && styles.loginChipTextActive]}
                >
                  Phone
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.loginChip, loginMethod === 'email' && styles.loginChipActive]}
              onPress={() => setLoginMethod('email')}
            >
              <Text
                style={[styles.loginChipText, loginMethod === 'email' && styles.loginChipTextActive]}
              >
                Email
              </Text>
            </Pressable>
          </View>

          {loginMethod === 'phone' ? (
            <>
              <Text style={styles.sectionLabel}>Mobile number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>+1</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="(555) 555-0100"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={14}
                />
              </View>
            </>
          ) : (
            <>
              <Input
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                hint={isSupabaseEnabled ? 'Your account password' : 'Demo: any password works'}
              />
            </>
          )}

          <Button
            title={loginMethod === 'phone' ? 'Send code' : 'Log in'}
            onPress={handleLogin}
            size="lg"
            disabled={!loginReady || isSubmitting}
            loading={isSubmitting}
            style={styles.submitBtn}
          />
        </>
      )}

      <Button title="Back" onPress={() => navigation.goBack()} variant="ghost" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  logoHeader: {
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  modeTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  modeTabActive: {
    borderBottomColor: colors.sparkOrange,
  },
  modeTabText: {
    ...typography.body,
    fontWeight: '500',
    color: colors.textMuted,
  },
  modeTabTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nameField: {
    flex: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  countryCode: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    minWidth: 56,
    alignItems: 'center',
  },
  countryCodeText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.body,
    color: colors.text,
  },
  legal: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
    textAlign: 'center',
  },
  agreementCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.sparkOrange,
    borderColor: colors.sparkOrange,
  },
  agreementText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 22,
  },
  link: {
    color: colors.sparkOrange,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  agreementPoint: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingLeft: 30,
  },
  agreementBullet: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
  agreementPointText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  loginMethodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  loginChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  loginChipActive: {
    borderColor: colors.sparkOrange,
    backgroundColor: colors.accentLight,
  },
  loginChipText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  loginChipTextActive: {
    color: colors.sparkOrange,
  },
  submitBtn: {
    marginBottom: spacing.sm,
  },
  demoNote: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  devTools: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  devToolsText: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    lineHeight: 16,
  },
  authErrorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  authErrorText: {
    ...typography.bodySmall,
    color: colors.error,
    flex: 1,
    lineHeight: 20,
  },
});
