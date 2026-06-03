import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Input, ScreenContainer } from '../components';
import { colors, spacing, typography } from '../constants/theme';
import { useApp } from '../context/AppContext';
import type { AuthScreenProps } from '../navigation/types';

type AuthMode = 'signup' | 'login';

export function AuthScreen({ navigation }: AuthScreenProps) {
  const { login } = useApp();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (mode === 'login') {
      login();
      navigation.replace('SpeedDateLobby');
    } else {
      navigation.navigate('ProfileCreation');
    }
  };

  return (
    <ScreenContainer scroll contentStyle={styles.content}>
      <Text style={styles.title}>
        {mode === 'signup' ? 'Create your account' : 'Welcome back'}
      </Text>
      <Text style={styles.subtitle}>
        {mode === 'signup'
          ? 'Join a safer, queer-centered dating experience'
          : 'Sign in to join the next speed date window'}
      </Text>

      <View style={styles.toggle}>
        <Pressable
          style={[styles.toggleBtn, mode === 'signup' && styles.toggleBtnActive]}
          onPress={() => setMode('signup')}
        >
          <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>
            Sign up
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, mode === 'login' && styles.toggleBtnActive]}
          onPress={() => setMode('login')}
        >
          <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>
            Log in
          </Text>
        </Pressable>
      </View>

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
      />

      {mode === 'signup' && (
        <Text style={styles.disclaimer}>
          By signing up, you agree to our community guidelines and confirm you are 18+.
        </Text>
      )}

      <Button
        title={mode === 'signup' ? 'Continue' : 'Log in'}
        onPress={handleSubmit}
        size="lg"
        style={styles.submitBtn}
      />

      <Button
        title="Back"
        onPress={() => navigation.goBack()}
        variant="ghost"
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
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
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    marginBottom: spacing.lg,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: colors.surface,
  },
  toggleText: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  submitBtn: {
    marginBottom: spacing.sm,
  },
});
