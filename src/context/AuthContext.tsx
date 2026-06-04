import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  getCurrentSession,
  isSupabaseConfigured,
  onAuthStateChange,
  signInWithEmail,
  signOutFromSupabase,
  signUpWithEmail,
  type SignInWithEmailInput,
  type SignUpResult,
  type SignUpWithEmailInput,
} from '../services';

interface AuthContextValue {
  isSupabaseEnabled: boolean;
  isAuthLoading: boolean;
  session: Session | null;
  authUser: User | null;
  signUp: (input: SignUpWithEmailInput) => Promise<SignUpResult>;
  signIn: (input: SignInWithEmailInput) => Promise<Session>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;

    getCurrentSession()
      .then((nextSession) => {
        if (isMounted) {
          setSession(nextSession);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      });

    const unsubscribe = onAuthStateChange((nextSession) => {
      if (isMounted) {
        setSession(nextSession);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  const signUp = useCallback(async (input: SignUpWithEmailInput) => {
    const result = await signUpWithEmail(input);
    setSession(result.session);
    return result;
  }, []);

  const signIn = useCallback(async (input: SignInWithEmailInput) => {
    const nextSession = await signInWithEmail(input);
    setSession(nextSession);
    return nextSession;
  }, []);

  const signOut = useCallback(async () => {
    await signOutFromSupabase();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isSupabaseEnabled: isSupabaseConfigured,
      isAuthLoading,
      session,
      authUser: session?.user ?? null,
      signUp,
      signIn,
      signOut,
    }),
    [isAuthLoading, session, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
