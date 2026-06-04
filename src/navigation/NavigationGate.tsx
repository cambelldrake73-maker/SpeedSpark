import { useEffect, useRef } from 'react';
import { createNavigationContainerRef } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { resolveOnboardingRoute } from '../utils/onboardingStatus';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * On cold start with a persisted Supabase session, routes the user to the
 * correct onboarding step or the lobby after hydration.
 */
export function NavigationGate() {
  const { isSupabaseEnabled, isAuthLoading, session } = useAuth();
  const { isLoggedIn, isHydrating, isOnboarded, onboarding, preferences } = useApp();
  const hasRoutedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseEnabled) {
      return;
    }
    if (!session?.user?.id) {
      hasRoutedRef.current = false;
      return;
    }
    if (isAuthLoading || isHydrating || !isLoggedIn) {
      return;
    }
    if (!navigationRef.isReady() || hasRoutedRef.current) {
      return;
    }

    const route = resolveOnboardingRoute({
      isOnboarded,
      profile: onboarding.profile,
      preferences,
    });

    hasRoutedRef.current = true;
    navigationRef.reset({
      index: 0,
      routes: [
        route === 'Verification'
          ? { name: 'Verification', params: { context: 'onboarding' } }
          : { name: route },
      ],
    });
  }, [
    isSupabaseEnabled,
    isAuthLoading,
    isHydrating,
    isLoggedIn,
    isOnboarded,
    onboarding.profile,
    preferences,
    session?.user?.id,
  ]);

  return null;
}
