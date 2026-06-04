import type { AuthError } from '@supabase/supabase-js';
import { formatSupabaseError, logSupabaseError } from './supabaseDebug';

/** Strips internal operation prefixes for display. */
function stripInternalPrefixes(message: string): string {
  return message
    .replace(/^(AuthScreen\.\w+|auth\.\w+):\s*/gi, '')
    .replace(/^app\.\w+:\s*/gi, '')
    .trim();
}

/** User-facing copy — no backend product names or dev operation labels. */
export function formatAuthErrorForUser(error: unknown): string {
  if (!error) {
    return 'Something went wrong. Please try again.';
  }

  let message = stripInternalPrefixes(
    error instanceof Error ? error.message : formatSupabaseError(error),
  );

  const lower = message.toLowerCase();

  if (lower.includes('load failed') || lower.includes('failed to fetch')) {
    return 'Unable to reach the account server. Check your internet connection and try again.';
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const authError = error as AuthError;
    const raw = authError.message?.toLowerCase() ?? '';

    if (authError.status === 400 && raw.includes('invalid login')) {
      return 'Incorrect email or password.';
    }
    if (raw.includes('already registered')) {
      return 'An account with this email already exists. Try logging in.';
    }
    if (raw.includes('email not confirmed')) {
      return 'Confirm your email first, then log in.';
    }
  }

  if (lower.includes('not configured')) {
    return 'Sign-in is not set up on this build. Contact support.';
  }

  return message || 'Something went wrong. Please try again.';
}

/** Dev/logs — may include operation label. */
export function formatAuthError(error: unknown, operation?: string): string {
  if (!error) {
    return operation ? `${operation}: Something went wrong.` : 'Something went wrong. Please try again.';
  }

  const message = formatSupabaseError(error, operation);

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const authError = error as AuthError;
    const raw = authError.message?.toLowerCase() ?? '';

    if (authError.status === 400 && raw.includes('invalid login')) {
      return operation ? `${operation}: Incorrect email or password.` : 'Incorrect email or password.';
    }
    if (raw.includes('already registered')) {
      return operation
        ? `${operation}: An account with this email already exists. Try logging in.`
        : 'An account with this email already exists. Try logging in.';
    }
    if (raw.includes('email not confirmed')) {
      return operation
        ? `${operation}: Confirm your email first, then log in.`
        : 'Confirm your email first, then log in.';
    }
  }

  return message;
}

export function logAuthDebug(label: string, detail?: unknown): void {
  if (__DEV__) {
    console.log(`[SpeedSpark Auth] ${label}`, detail ?? '');
  }
}

export function logAndFormatAuthError(operation: string, error: unknown): string {
  logSupabaseError(operation, error);
  if (__DEV__) {
    console.error(`[SpeedSpark Auth] ${operation} (user message)`, formatAuthErrorForUser(error));
  }
  return formatAuthErrorForUser(error);
}
