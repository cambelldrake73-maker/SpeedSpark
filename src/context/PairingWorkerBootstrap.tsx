import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useApp } from './AppContext';
import { startAutoPairingWorker, stopAutoPairingWorker } from '../services/autoPairingWorker';

if (__DEV__) {
  require('../services/dev/matchingDev');
}

/**
 * Invisible bootstrap: runs automatic pairing on an interval while a Supabase
 * session is active. No UI changes.
 */
export function PairingWorkerBootstrap() {
  const { isSupabaseEnabled, session } = useAuth();
  const { isLoggedIn } = useApp();

  useEffect(() => {
    if (!isSupabaseEnabled || !session?.user?.id || !isLoggedIn) {
      stopAutoPairingWorker();
      return;
    }

    startAutoPairingWorker();
    return () => {
      stopAutoPairingWorker();
    };
  }, [isSupabaseEnabled, isLoggedIn, session?.user?.id]);

  return null;
}
