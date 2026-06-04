import type { Session, User } from '@supabase/supabase-js';
import {
  logSupabaseRequest,
  throwSupabaseError,
} from '../utils/supabaseDebug';
import { logSignUpFailureDiagnostics } from './supabaseHealth';
import { isSupabaseConfigured, requireSupabase } from './supabase';

export interface SignUpWithEmailInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  age: number;
}

export interface SignInWithEmailInput {
  email: string;
  password: string;
}

export interface SignUpResult {
  user: User;
  session: Session | null;
  needsEmailConfirmation: boolean;
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const op = 'auth.getSession';
  logSupabaseRequest(op);
  const { data, error } = await requireSupabase().auth.getSession();
  if (error) {
    throwSupabaseError(op, error);
  }
  return data.session;
}

export async function signUpWithEmail(input: SignUpWithEmailInput): Promise<SignUpResult> {
  const client = requireSupabase();
  const email = input.email.trim().toLowerCase();
  const displayName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
  const op = 'auth.signUp';

  logSupabaseRequest(op, { email, displayName, age: input.age });

  const { data, error } = await client.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        display_name: displayName,
        age: input.age,
      },
    },
  });

  if (error) {
    await logSignUpFailureDiagnostics(email, error);
    throwSupabaseError(op, error);
  }

  if (!data.user) {
    throwSupabaseError(op, { message: 'Sign up did not return a user.' });
  }

  const needsEmailConfirmation = !data.session;
  console.log('[SpeedSpark Supabase] ✓ auth.signUp', {
    userId: data.user.id,
    hasSession: Boolean(data.session),
    needsEmailConfirmation,
  });

  return {
    user: data.user,
    session: data.session,
    needsEmailConfirmation,
  };
}

export async function signInWithEmail(input: SignInWithEmailInput): Promise<Session> {
  const client = requireSupabase();
  const email = input.email.trim().toLowerCase();
  const op = 'auth.signInWithPassword';

  logSupabaseRequest(op, { email });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error) {
    throwSupabaseError(op, error);
  }

  if (!data.session) {
    throwSupabaseError(op, {
      message: 'Log in returned no session. Confirm your email if required.',
    });
  }

  console.log('[SpeedSpark Supabase] ✓ auth.signInWithPassword', {
    userId: data.session.user.id,
  });
  return data.session;
}

export async function signOutFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  const op = 'auth.signOut';
  logSupabaseRequest(op);
  const { error } = await requireSupabase().auth.signOut();
  if (error) {
    throwSupabaseError(op, error);
  }
  console.log('[SpeedSpark Supabase] ✓ auth.signOut');
}

export function onAuthStateChange(
  callback: (session: Session | null) => void,
): (() => void) | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data } = requireSupabase().auth.onAuthStateChange((event, session) => {
    console.log('[SpeedSpark Supabase] auth.onAuthStateChange', {
      event,
      userId: session?.user.id ?? null,
    });
    callback(session);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
